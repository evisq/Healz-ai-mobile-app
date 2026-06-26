package expo.modules.healzpdfcompressor

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.cos.COSStream
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDResources
import com.tom_roush.pdfbox.pdmodel.graphics.PDXObject
import com.tom_roush.pdfbox.pdmodel.graphics.form.PDFormXObject
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Collections
import java.util.IdentityHashMap
import kotlin.math.max
import kotlin.math.roundToInt

private const val PDF_MEMORY_LIMIT_BYTES = 16L * 1024L * 1024L
private const val MIN_IMAGE_EDGE_TO_RECOMPRESS = 800

class PdfCompressionOptions : Record {
  @Field
  val imageQuality: Double = 0.86

  @Field
  val maxImageDimension: Int = 2800
}

class HealzPdfCompressorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HealzPdfCompressor")

    AsyncFunction("compressAsync") Coroutine {
        inputUri: String,
        outputUri: String,
        options: PdfCompressionOptions ->
      withContext(Dispatchers.IO) {
        compressPdf(inputUri, outputUri, options)
      }
    }
  }

  private fun compressPdf(
    inputUri: String,
    outputUri: String,
    options: PdfCompressionOptions
  ): Map<String, Any> {
    val context = appContext.reactContext
      ?: throw IllegalStateException("React context is unavailable")
    PDFBoxResourceLoader.init(context.applicationContext)

    val inputFile = requireFileUri(inputUri)
    val outputFile = requireFileUri(outputUri)

    require(inputFile.exists() && inputFile.isFile) {
      "Исходный PDF больше недоступен."
    }
    outputFile.parentFile?.mkdirs()

    val memory = MemoryUsageSetting.setupMixed(PDF_MEMORY_LIMIT_BYTES)
    var pageCount: Int
    val stats = CompressionStats()

    PDDocument.load(inputFile, "", memory).use { document ->
      require(!document.isEncrypted) {
        "Зашифрованный PDF отправляется без изменений."
      }

      pageCount = document.numberOfPages
      require(pageCount > 0) {
        "PDF не содержит страниц."
      }

      val replacements = IdentityHashMap<COSStream, PDImageXObject>()
      val visitedForms = Collections.newSetFromMap(
        IdentityHashMap<COSStream, Boolean>()
      )

      for (page in document.pages) {
        processResources(
          document = document,
          resources = page.resources,
          options = options,
          replacements = replacements,
          visitedForms = visitedForms,
          stats = stats
        )
      }

      document.save(outputFile)
    }

    require(outputFile.exists() && outputFile.length() > 0L) {
      "PDF-компрессор не создал корректный файл."
    }

    PDDocument.load(outputFile, memory).use { validationDocument ->
      require(validationDocument.numberOfPages == pageCount) {
        "После оптимизации изменилось количество страниц PDF."
      }
    }

    return mapOf(
      "imagesProcessed" to stats.imagesProcessed,
      "outputSize" to outputFile.length(),
      "pageCount" to pageCount
    )
  }

  private fun processResources(
    document: PDDocument,
    resources: PDResources?,
    options: PdfCompressionOptions,
    replacements: IdentityHashMap<COSStream, PDImageXObject>,
    visitedForms: MutableSet<COSStream>,
    stats: CompressionStats
  ) {
    if (resources == null) {
      return
    }

    for (name in resources.xObjectNames.toList()) {
      when (val xObject: PDXObject = resources.getXObject(name)) {
        is PDImageXObject -> {
          val stream = xObject.cosObject
          val replacement = replacements[stream] ?: recompressImage(
            document,
            xObject,
            options
          )?.also {
            replacements[stream] = it
            stats.imagesProcessed += 1
          }

          if (replacement != null) {
            resources.put(name, replacement)
          }
        }

        is PDFormXObject -> {
          if (visitedForms.add(xObject.cosObject)) {
            processResources(
              document = document,
              resources = xObject.resources,
              options = options,
              replacements = replacements,
              visitedForms = visitedForms,
              stats = stats
            )
          }
        }
      }
    }
  }

  private fun recompressImage(
    document: PDDocument,
    imageObject: PDImageXObject,
    options: PdfCompressionOptions
  ): PDImageXObject? {
    if (
      imageObject.width < MIN_IMAGE_EDGE_TO_RECOMPRESS &&
      imageObject.height < MIN_IMAGE_EDGE_TO_RECOMPRESS
    ) {
      return null
    }

    val source = imageObject.image ?: return null
    var scaled: Bitmap = source
    var opaque: Bitmap = source

    try {
      val maxDimension = options.maxImageDimension.coerceIn(1600, 4000)
      val longEdge = max(source.width, source.height)

      if (longEdge > maxDimension) {
        val scale = maxDimension.toDouble() / longEdge.toDouble()
        val targetWidth = (source.width * scale).roundToInt().coerceAtLeast(1)
        val targetHeight = (source.height * scale).roundToInt().coerceAtLeast(1)
        scaled = Bitmap.createScaledBitmap(
          source,
          targetWidth,
          targetHeight,
          true
        )
      }

      if (scaled.hasAlpha()) {
        opaque = Bitmap.createBitmap(
          scaled.width,
          scaled.height,
          Bitmap.Config.ARGB_8888
        )
        Canvas(opaque).apply {
          drawColor(Color.WHITE)
          drawBitmap(scaled, 0f, 0f, null)
        }
      } else {
        opaque = scaled
      }

      return JPEGFactory.createFromImage(
        document,
        opaque,
        options.imageQuality.coerceIn(0.8, 0.92).toFloat()
      ).apply {
        interpolate = imageObject.interpolate
      }
    } finally {
      if (opaque !== scaled && !opaque.isRecycled) {
        opaque.recycle()
      }
      if (scaled !== source && !scaled.isRecycled) {
        scaled.recycle()
      }
      if (!source.isRecycled) {
        source.recycle()
      }
    }
  }

  private fun requireFileUri(uriString: String): File {
    val uri = Uri.parse(uriString)

    require(uri.scheme.isNullOrEmpty() || uri.scheme == "file") {
      "PDF-компрессор принимает только локальные файлы."
    }

    val path = if (uri.scheme == "file") uri.path else uriString
    require(!path.isNullOrBlank()) {
      "Не удалось определить путь к PDF."
    }

    return File(path)
  }

  private class CompressionStats(
    var imagesProcessed: Int = 0
  )
}

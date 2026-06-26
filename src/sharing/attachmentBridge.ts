import type { AttachmentPayload } from './types';

export const BASE64_BRIDGE_CHUNK_SIZE = 128 * 1024;
export const ATTACHMENT_MESSAGE_SOURCE = 'healz-mobile-share';

type AttachmentMetadata = Omit<AttachmentPayload, 'base64'>;

export function* iterateBase64Chunks(
  base64: string,
  chunkSize = BASE64_BRIDGE_CHUNK_SIZE,
) {
  const safeChunkSize = Math.max(4, chunkSize - (chunkSize % 4));

  for (let offset = 0; offset < base64.length; offset += safeChunkSize) {
    yield base64.slice(offset, offset + safeChunkSize);
  }
}

export function createAttachmentInitScript(files: AttachmentMetadata[]) {
  return `
    (function () {
      window.__HEALZ_MOBILE_SHARE__ = {
        files: ${JSON.stringify(files)}.map(function (file) {
          return Object.assign({}, file, { parts: [] });
        })
      };
    })();
    true;
  `;
}

export function createAttachmentChunkScript(
  fileIndex: number,
  chunk: string,
) {
  return `
    (function () {
      var state = window.__HEALZ_MOBILE_SHARE__;
      if (state && state.files && state.files[${fileIndex}]) {
        state.files[${fileIndex}].parts.push(${JSON.stringify(chunk)});
      }
    })();
    true;
  `;
}

export function createAttachmentFinalizeScript() {
  return `
    (function () {
      var SOURCE = ${JSON.stringify(ATTACHMENT_MESSAGE_SOURCE)};
      var state = window.__HEALZ_MOBILE_SHARE__;

      function report(type, message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            source: SOURCE,
            type: type,
            message: message || undefined
          }));
        }
      }

      function decodeParts(parts, mimeType) {
        var byteParts = [];

        for (var partIndex = 0; partIndex < parts.length; partIndex += 1) {
          var binary = window.atob(parts[partIndex]);
          var bytes = new Uint8Array(binary.length);

          for (var byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
            bytes[byteIndex] = binary.charCodeAt(byteIndex);
          }

          byteParts.push(bytes);
        }

        return new Blob(byteParts, { type: mimeType });
      }

      function acceptsFile(input, file) {
        var accept = (input.getAttribute('accept') || '').trim().toLowerCase();

        if (!accept) {
          return true;
        }

        var fileName = file.name.toLowerCase();
        var mimeType = file.type.toLowerCase();

        return accept.split(',').some(function (rawToken) {
          var token = rawToken.trim();

          if (!token) {
            return false;
          }

          if (token.charAt(0) === '.') {
            return fileName.endsWith(token);
          }

          if (token.endsWith('/*')) {
            return mimeType.startsWith(token.slice(0, -1));
          }

          return mimeType === token;
        });
      }

      try {
        if (!state || !state.files || state.files.length === 0) {
          report('ERROR', 'В мост не переданы файлы.');
          return;
        }

        if (
          typeof File === 'undefined' ||
          typeof Blob === 'undefined' ||
          typeof DataTransfer === 'undefined'
        ) {
          report(
            'UNSUPPORTED_BROWSER',
            'Эта версия Android WebView не поддерживает программное вложение.'
          );
          return;
        }

        var files = state.files.map(function (item) {
          var blob = decodeParts(item.parts, item.mimeType);
          return new File([blob], item.name, {
            lastModified: Date.now(),
            type: item.mimeType
          });
        });

        var deadline = Date.now() + 10000;

        function findInput() {
          var inputs = Array.prototype.slice.call(
            document.querySelectorAll('input[type="file"]')
          ).filter(function (input) {
            return !input.disabled;
          });

          return (
            inputs.find(function (input) {
              return files.every(function (file) {
                return acceptsFile(input, file);
              });
            }) ||
            inputs[0] ||
            null
          );
        }

        function attachWhenReady() {
          var input = findInput();

          if (!input) {
            if (Date.now() < deadline) {
              window.setTimeout(attachWhenReady, 250);
              return;
            }

            report(
              'INPUT_NOT_FOUND',
              'Штатное поле загрузки Healz не найдено. Откройте чат и повторите.'
            );
            return;
          }

          if (files.length > 1 && !input.multiple) {
            report(
              'MULTIPLE_NOT_SUPPORTED',
              'Этот экран Healz принимает только один файл за раз.'
            );
            return;
          }

          var transfer = new DataTransfer();
          files.forEach(function (file) {
            transfer.items.add(file);
          });

          var filesDescriptor = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'files'
          );

          if (filesDescriptor && filesDescriptor.set) {
            filesDescriptor.set.call(input, transfer.files);
          } else {
            Object.defineProperty(input, 'files', {
              configurable: true,
              value: transfer.files
            });
          }

          input.dispatchEvent(
            new Event('input', { bubbles: true, composed: true })
          );
          input.dispatchEvent(
            new Event('change', { bubbles: true, composed: true })
          );

          window.__HEALZ_MOBILE_SHARE__ = undefined;
          report('ATTACHED', 'Файл передан в загрузчик Healz.');
        }

        attachWhenReady();
      } catch (error) {
        report(
          'ERROR',
          error && error.message
            ? error.message
            : 'Не удалось передать файл в Healz.'
        );
      }
    })();
    true;
  `;
}

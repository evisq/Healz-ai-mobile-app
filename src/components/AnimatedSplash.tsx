import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

import { BrandHeart } from '../brand/BrandHeart';

type AnimatedSplashProps = {
  isWebContentReady: boolean;
  onFinished: () => void;
};

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

export function AnimatedSplash({
  isWebContentReady,
  onFinished,
}: AnimatedSplashProps) {
  const { height } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const brandColor = isDark ? '#F1E6EB' : '#4B4040';
  const [isIntroFinished, setIsIntroFinished] = useState(false);
  const hasStarted = useRef(false);
  const isExitRunning = useRef(false);

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartShift = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkShift = useRef(new Animated.Value(-58)).current;
  const brandLift = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;

  const startIntro = () => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    void SplashScreen.hideAsync()
      .catch(() => undefined)
      .then(() => {
        Animated.sequence([
          Animated.timing(heartScale, {
            duration: 820,
            easing: EASE_OUT,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.delay(90),
          Animated.parallel([
            Animated.timing(heartShift, {
              duration: 650,
              easing: EASE_OUT,
              toValue: -72,
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkShift, {
              duration: 650,
              easing: EASE_OUT,
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkOpacity, {
              duration: 400,
              easing: EASE_OUT,
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
        ]).start(({ finished }) => {
          if (finished) {
            setIsIntroFinished(true);
          }
        });
      });
  };

  useEffect(() => {
    if (!isIntroFinished || isExitRunning.current) {
      return;
    }

    const revealDelay = isWebContentReady ? 280 : 4500;
    const timer = setTimeout(() => {
      if (isExitRunning.current) {
        return;
      }

      isExitRunning.current = true;

      Animated.parallel([
        Animated.timing(brandLift, {
          duration: 620,
          easing: EASE_IN,
          toValue: -height * 0.72,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(430),
          Animated.timing(brandOpacity, {
            duration: 190,
            easing: Easing.linear,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(backdropOpacity, {
            duration: 470,
            easing: EASE_IN,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          onFinished();
        }
      });
    }, revealDelay);

    return () => clearTimeout(timer);
  }, [
    backdropOpacity,
    brandLift,
    brandOpacity,
    height,
    isIntroFinished,
    isWebContentReady,
    onFinished,
  ]);

  return (
    <View onLayout={startIntro} pointerEvents="auto" style={styles.container}>
      <Animated.View
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark ? '#181416' : '#FFF8FA',
            opacity: backdropOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.brand,
          {
            opacity: brandOpacity,
            transform: [{ translateY: brandLift }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.heart,
            {
              transform: [
                { translateX: heartShift },
                { scale: heartScale },
              ],
            },
          ]}
        >
          <BrandHeart color={brandColor} />
        </Animated.View>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.wordmark,
            {
              color: brandColor,
              opacity: wordmarkOpacity,
              transform: [{ translateX: wordmarkShift }],
            },
          ]}
        >
          healz ai
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  brand: {
    height: 96,
    position: 'relative',
    width: 300,
  },
  heart: {
    left: 107,
    position: 'absolute',
    top: 11,
    zIndex: 2,
  },
  wordmark: {
    fontSize: 43,
    fontWeight: '700',
    left: 125,
    letterSpacing: -2.5,
    lineHeight: 54,
    position: 'absolute',
    top: 20,
    zIndex: 1,
  },
});

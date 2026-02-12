import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import Colors from "../constants/colors";

interface CustomToastProps {
  icon?: React.ReactNode; // Supports React Native Vector Icons or any JSX
  title: string;
  subTitle?: string | null;

  buttonOneText: string;
  buttonTwoText?: string;
  onButtonOnePress: () => void;
  onButtonTwoPress?: () => void;

  animationType?: "fade" | "slideUp" | "scale";
  autoDismiss?: boolean;
  dismissDuration?: number;
  onDismiss?: () => void;
}

const CustomToast: React.FC<CustomToastProps> = ({
  icon,
  title,
  subTitle,
  buttonOneText,
  buttonTwoText,
  onButtonOnePress,
  onButtonTwoPress,
  animationType = "fade",
  autoDismiss = false,
  dismissDuration = 3000,
  onDismiss,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  // --- Animation In ---
  const animateIn = () => {
    switch (animationType) {
      case "slideUp":
        animatedValue.setValue(50);
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
        break;

      case "scale":
        animatedValue.setValue(0.5);
        Animated.spring(animatedValue, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
        break;

      default: // fade
        animatedValue.setValue(0);
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
    }
  };

  // --- Animation Out ---
  const animateOut = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss && onDismiss();
    });
  };

  // Auto-dismiss logic
  useEffect(() => {
    animateIn();

    if (autoDismiss) {
      const timer = setTimeout(() => {
        animateOut();
      }, dismissDuration);

      return () => clearTimeout(timer);
    }
  }, []);

  // Determine animation style
  const animatedStyle =
    animationType === "slideUp"
      ? { transform: [{ translateY: animatedValue }] }
      : animationType === "scale"
      ? { transform: [{ scale: animatedValue }] }
      : { opacity: animatedValue };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}

      <Text style={styles.title}>{title}</Text>

      {subTitle ? <Text style={styles.subTitle}>{subTitle}</Text> : null}

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.buttonOne, !buttonTwoText && { marginRight: 0 }]}
          onPress={onButtonOnePress}
        >
          <Text style={styles.buttonOneText}>{buttonOneText}</Text>
        </TouchableOpacity>

        {buttonTwoText ? (
          <TouchableOpacity style={styles.buttonTwo} onPress={onButtonTwoPress}>
            <Text style={styles.buttonTwoText}>{buttonTwoText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
};

export default CustomToast;

const styles = StyleSheet.create({
  container: {
    width: "90%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  subTitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 6,
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    marginTop: 20,
    width: "100%",
    justifyContent: "space-between",
  },
  buttonOne: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.bronze,
    borderRadius: 10,
    marginRight: 8,
    alignItems: "center",
  },
  buttonTwo: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#E5E5E5",
    borderRadius: 10,
    marginLeft: 8,
    alignItems: "center",
  },
  buttonOneText: {
    color: "#fff",
    fontWeight: "600",
  },
  buttonTwoText: {
    color: "#333",
    fontWeight: "600",
  },
});

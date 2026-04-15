import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");
const GUIDELINE_BASE_WIDTH = 390;

const normalize = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel((width / GUIDELINE_BASE_WIDTH) * size));

export const theme = {
  normalize,
  spacing: {
    xs: normalize(6),
    sm: normalize(10),
    md: normalize(16),
    lg: normalize(24),
  },
  borderRadius: {
    full: 999,
  },
  layout: {
    screenHeight: height,
  },
};

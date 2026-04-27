export type SelectedConfig =
  | "banner"
  | "thumbnail"
  | "icon"
  | "content";

export const ImageLayout = {
  banner: {
    mode: "fill",
    className: "relative w-full h-64",
    imageClassName: "object-cover",
  },

  thumbnail: {
    mode: "intrinsic",
    width: 300,
    height: 300,
    imageClassName: "object-cover",
  },

  icon: {
    mode: "intrinsic",
    width: 32,
    height: 32,
    imageClassName: "object-contain",
  },

  content: {
    mode: "responsive",
    width: 800,
    height: 600,
    imageClassName: "object-contain",
  },
} as const;

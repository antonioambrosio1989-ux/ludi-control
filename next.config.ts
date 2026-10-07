import type {
  NextConfig,
} from "next";

/*
 * ============================================================
 * SECURITY HEADERS
 * ============================================================
 */

const scriptSource =
  process.env.NODE_ENV ===
  "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.instagram.com https://www.gstatic.com"
    : "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.instagram.com https://www.gstatic.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",

  /*
   * ==========================================================
   * SCRIPTS
   * ==========================================================
   */

  scriptSource,

  /*
   * ==========================================================
   * STYLES
   * ==========================================================
   */

  "style-src 'self' 'unsafe-inline'",

  /*
   * ==========================================================
   * IMAGES
   * ==========================================================
   *
   * i.ytimg.com / img.youtube.com:
   * miniature e copertine automatiche YouTube.
   * ==========================================================
   */

  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.ufs.sh https://utfs.io https://*.fbcdn.net https://*.cdninstagram.com https://i.ytimg.com https://img.youtube.com",

  /*
   * ==========================================================
   * FONTS
   * ==========================================================
   */

  "font-src 'self' data:",

  /*
   * ==========================================================
   * CONNECTIONS
   * ==========================================================
   */

  `connect-src 'self' ${process.env.NODE_ENV === "development" ? "http://127.0.0.1:8080 http://127.0.0.1:9099 ws://localhost:* ws://127.0.0.1:*" : ""} https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://api.stripe.com https://*.ingest.uploadthing.com https://*.ufs.sh https://utfs.io https://www.instagram.com`,

  /*
   * ==========================================================
   * IFRAMES
   * ==========================================================
   *
   * YouTube viene utilizzato per:
   *
   * - Goal Parade
   * - Save Parade
   * - Highlights
   * - altri contenuti Ludi TV
   *
   * Supportiamo sia youtube.com sia youtube-nocookie.com.
   * ==========================================================
   */

  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.instagram.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",

  /*
   * ==========================================================
   * WORKERS
   * ==========================================================
   */

  "worker-src 'self' blob:",

  /*
   * ==========================================================
   * MEDIA
   * ==========================================================
   */

  "media-src 'self' blob: https://*.ufs.sh https://utfs.io",
].join(
  "; ",
);

const securityHeaders = [
  {
    key:
      "Content-Security-Policy",

    value:
      contentSecurityPolicy,
  },

  {
    key:
      "X-Content-Type-Options",

    value:
      "nosniff",
  },

  {
    key:
      "X-Frame-Options",

    value:
      "DENY",
  },

  {
    key:
      "Referrer-Policy",

    value:
      "strict-origin-when-cross-origin",
  },

  {
    key:
      "Permissions-Policy",

    value:
      [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=(self)",
        "usb=()",
      ].join(
        ", ",
      ),
  },

  {
    key:
      "Cross-Origin-Opener-Policy",

    value:
      "same-origin",
  },

  {
    key:
      "X-DNS-Prefetch-Control",

    value:
      "on",
  },

  {
    key:
      "Strict-Transport-Security",

    value:
      "max-age=31536000",
  },
] as const;

/*
 * ============================================================
 * NEXT CONFIG
 * ============================================================
 */

const nextConfig:
  NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
      /*
       * ======================================================
       * UPLOADTHING
       * ======================================================
       */

      {
        protocol:
          "https",

        hostname:
          "**.ufs.sh",

        pathname:
          "/f/**",
      },

      {
        protocol:
          "https",

        hostname:
          "utfs.io",

        pathname:
          "/f/**",
      },

      /*
       * ======================================================
       * META / INSTAGRAM
       * ======================================================
       */

      {
        protocol:
          "https",

        hostname:
          "**.fbcdn.net",

        pathname:
          "/**",
      },

      {
        protocol:
          "https",

        hostname:
          "**.cdninstagram.com",

        pathname:
          "/**",
      },

      /*
       * ======================================================
       * YOUTUBE
       * ======================================================
       */

      {
        protocol:
          "https",

        hostname:
          "i.ytimg.com",

        pathname:
          "/**",
      },

      {
        protocol:
          "https",

        hostname:
          "img.youtube.com",

        pathname:
          "/**",
      },
    ],
  },

  /*
   * ==========================================================
   * HTTP SECURITY HEADERS
   * ==========================================================
   */

  async headers() {
    return [
      {
        source:
          "/:path*",

        headers:
          securityHeaders.map(
            (
              header,
            ) => ({
              key:
                header.key,

              value:
                header.value,
            }),
          ),
      },
    ];
  },
};

export default nextConfig;
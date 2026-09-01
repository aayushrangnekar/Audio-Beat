import {
  useEffect,
  useState,
} from "react";

export interface AlbumArtworkTheme {
  primary: string;
  glow: string;
  deep: string;
  darker: string;
  lyrics: string;
}

const DEFAULT_COLOR = "#282828";

const cache =
  new Map<string, AlbumArtworkTheme>();

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  );
}

function parseHexColor(
  color: string
): [number, number, number] | null {
  const normalized =
    color.trim().replace("#", "");

  if (
    !/^[0-9a-fA-F]{6}$/.test(
      normalized
    )
  ) {
    return null;
  }

  return [
    Number.parseInt(
      normalized.slice(0, 2),
      16
    ),
    Number.parseInt(
      normalized.slice(2, 4),
      16
    ),
    Number.parseInt(
      normalized.slice(4, 6),
      16
    ),
  ];
}

function mix(
  source: [number, number, number],
  target: [number, number, number],
  amount: number
): [number, number, number] {
  return [
    Math.round(
      source[0] +
        (target[0] - source[0]) *
          amount
    ),
    Math.round(
      source[1] +
        (target[1] - source[1]) *
          amount
    ),
    Math.round(
      source[2] +
        (target[2] - source[2]) *
          amount
    ),
  ];
}

function rgb(
  color: [number, number, number]
): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function rgba(
  color: [number, number, number],
  alpha: number
): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function buildTheme(
  source: [number, number, number]
): AlbumArtworkTheme {
  const average =
    (
      source[0] +
      source[1] +
      source[2]
    ) / 3;

  let balanced = source;

  if (average > 175) {
    balanced = mix(
      balanced,
      [0, 0, 0],
      0.4
    );
  } else if (average < 42) {
    balanced = mix(
      balanced,
      [255, 255, 255],
      0.2
    );
  }

  const maximum =
    Math.max(...balanced);
  const minimum =
    Math.min(...balanced);

  if (
    maximum - minimum <
    50
  ) {
    const dominant =
      balanced.indexOf(maximum);

    balanced =
      balanced.map(
        (
          channel,
          index
        ) =>
          clamp(
            Math.round(
              channel *
                (
                  index === dominant
                    ? 1.18
                    : 0.9
                )
            ),
            0,
            255
          )
      ) as [
        number,
        number,
        number
      ];
  }

  const deep =
    mix(
      balanced,
      [0, 0, 0],
      0.48
    );

  const darker =
    mix(
      balanced,
      [0, 0, 0],
      0.73
    );

  const lyrics =
    mix(
      balanced,
      [0, 0, 0],
      0.24
    );

  return {
    primary: rgb(balanced),
    glow: rgba(
      balanced,
      0.96
    ),
    deep: rgb(deep),
    darker: rgb(darker),
    lyrics: rgb(lyrics),
  };
}

function fallbackTheme(
  fallbackColor?: string
): AlbumArtworkTheme {
  return buildTheme(
    parseHexColor(
      fallbackColor ||
        DEFAULT_COLOR
    ) || [40, 40, 40]
  );
}

function extractArtworkTheme(
  source: string,
  fallbackColor?: string
): Promise<AlbumArtworkTheme> {
  const cached =
    cache.get(source);

  if (cached) {
    return Promise.resolve(
      cached
    );
  }

  return new Promise(
    (resolve) => {
      const image =
        new Image();

      if (
        source.startsWith(
          "http://"
        ) ||
        source.startsWith(
          "https://"
        )
      ) {
        image.crossOrigin =
          "anonymous";
      }

      image.onload = () => {
        try {
          const canvas =
            document.createElement(
              "canvas"
            );

          const size = 48;

          canvas.width = size;
          canvas.height = size;

          const context =
            canvas.getContext(
              "2d",
              {
                willReadFrequently:
                  true,
              }
            );

          if (!context) {
            resolve(
              fallbackTheme(
                fallbackColor
              )
            );
            return;
          }

          context.drawImage(
            image,
            0,
            0,
            size,
            size
          );

          const pixels =
            context.getImageData(
              0,
              0,
              size,
              size
            ).data;

          const buckets =
            new Map<
              string,
              {
                count: number;
                red: number;
                green: number;
                blue: number;
                score: number;
              }
            >();

          for (
            let index = 0;
            index < pixels.length;
            index += 16
          ) {
            const red =
              pixels[index];
            const green =
              pixels[index + 1];
            const blue =
              pixels[index + 2];
            const alpha =
              pixels[index + 3];

            if (alpha < 180) {
              continue;
            }

            const maximum =
              Math.max(
                red,
                green,
                blue
              );

            const minimum =
              Math.min(
                red,
                green,
                blue
              );

            const brightness =
              (maximum + minimum) /
              2;

            const saturation =
              maximum - minimum;

            if (
              brightness < 18 ||
              brightness > 240
            ) {
              continue;
            }

            const key =
              [
                Math.round(
                  red / 32
                ),
                Math.round(
                  green / 32
                ),
                Math.round(
                  blue / 32
                ),
              ].join("-");

            const weight =
              1 +
              saturation / 85;

            const existing =
              buckets.get(key);

            if (existing) {
              existing.count += 1;
              existing.red += red;
              existing.green +=
                green;
              existing.blue += blue;
              existing.score +=
                weight;
            } else {
              buckets.set(
                key,
                {
                  count: 1,
                  red,
                  green,
                  blue,
                  score: weight,
                }
              );
            }
          }

          const winner =
            Array.from(
              buckets.values()
            ).sort(
              (
                left,
                right
              ) =>
                right.score -
                left.score
            )[0];

          if (!winner) {
            resolve(
              fallbackTheme(
                fallbackColor
              )
            );
            return;
          }

          const theme =
            buildTheme([
              Math.round(
                winner.red /
                  winner.count
              ),
              Math.round(
                winner.green /
                  winner.count
              ),
              Math.round(
                winner.blue /
                  winner.count
              ),
            ]);

          cache.set(
            source,
            theme
          );

          resolve(theme);
        } catch {
          resolve(
            fallbackTheme(
              fallbackColor
            )
          );
        }
      };

      image.onerror = () => {
        resolve(
          fallbackTheme(
            fallbackColor
          )
        );
      };

      image.src = source;
    }
  );
}

export function useAlbumArtworkTheme(
  albumArt?: string | null,
  fallbackColor?: string
): AlbumArtworkTheme {
  const [
    theme,
    setTheme,
  ] = useState<AlbumArtworkTheme>(
    () =>
      fallbackTheme(
        fallbackColor
      )
  );

  useEffect(() => {
    let cancelled = false;

    setTheme(
      fallbackTheme(
        fallbackColor
      )
    );

    if (!albumArt) {
      return () => {
        cancelled = true;
      };
    }

    void extractArtworkTheme(
      albumArt,
      fallbackColor
    ).then(
      (
        extractedTheme
      ) => {
        if (!cancelled) {
          setTheme(
            extractedTheme
          );
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    albumArt,
    fallbackColor,
  ]);

  return theme;
}

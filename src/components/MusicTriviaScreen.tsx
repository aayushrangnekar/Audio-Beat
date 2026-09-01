import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  ArrowLeftIcon,
  CheckIcon,
  HeartIcon,
  LoaderCircleIcon,
  Music2Icon,
  RotateCcwIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react";

import {
  usePlayer,
} from "../context/PlayerContext";

import type {
  Song,
} from "../types";

interface Props {
  onBack: () => void;
}

type TriviaSong =
  Song & {
    year?: number;
    genre?: string;
    cloudPublicId?: string;
  };

type TriviaQuestionType =
  | "artist-verification"
  | "album-artist-verification"
  | "album-year-verification"
  | "album-art-identification"
  | "song-artist-identification"
  | "album-year-identification"
  | "playing-album-art";

interface TextOption {
  id: string;
  label: string;
}

interface ImageOption {
  id: string;
  label: string;
  image: string;
}

interface TriviaQuestion {
  id: string;
  type: TriviaQuestionType;
  prompt: string;
  song: TriviaSong;
  answerId: string;
  textOptions?: TextOption[];
  imageOptions?: ImageOption[];
  shouldPlayAudio: boolean;
  excerptStart: number;
}

interface TriviaRound {
  round: number;
  secondsPerQuestion: number;
  questions: TriviaQuestion[];
}

type GamePhase =
  | "loading"
  | "round-intro"
  | "question"
  | "game-over"
  | "winner"
  | "not-enough-music";

type AnswerState =
  | "idle"
  | "correct"
  | "wrong"
  | "timeout";

const ROUND_TIMERS = [
  30,
  25,
  20,
  15,
  10,
] as const;

const QUESTIONS_PER_ROUND = 7;
const MAX_LIVES = 3;
const ANSWER_TRANSITION_MS = 1150;
const ROUND_INTRO_MS = 1500;
const MIN_LOADING_MS = 950;
const EXCERPT_SECONDS = 11;

const UNKNOWN_VALUES =
  new Set([
    "",
    "unknown artist",
    "unknown album",
    "unknown title",
    "<unknown>",
    "various artists",
  ]);

function clean(
  value:
    | string
    | undefined
    | null
): string {
  return value
    ?.trim()
    .replace(/\s+/g, " ") ?? "";
}

function normalise(
  value:
    | string
    | undefined
    | null
): string {
  return clean(
    value
  ).toLocaleLowerCase();
}

function validText(
  value:
    | string
    | undefined
    | null
): boolean {
  const normalised =
    normalise(value);

  return (
    Boolean(normalised) &&
    !UNKNOWN_VALUES.has(
      normalised
    )
  );
}

function validYear(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 1900 &&
    value <=
      new Date().getFullYear() +
        1
  );
}

function shuffle<T>(
  items: T[]
): T[] {
  const copy =
    [...items];

  for (
    let index =
      copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      Math.floor(
        Math.random() *
          (index + 1)
      );

    [
      copy[index],
      copy[swapIndex],
    ] = [
      copy[swapIndex],
      copy[index],
    ];
  }

  return copy;
}

function randomItem<T>(
  items: T[]
): T {
  return items[
    Math.floor(
      Math.random() *
        items.length
    )
  ];
}

function uniqueBy<T>(
  items: T[],
  keyForItem: (
    item: T
  ) => string
): T[] {
  const seen =
    new Set<string>();

  return items.filter(
    (
      item
    ) => {
      const key =
        keyForItem(item);

      if (
        !key ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}

function randomExcerptStart(
  song: TriviaSong
): number {
  const duration =
    Number.isFinite(
      song.duration
    )
      ? Math.max(
          0,
          song.duration
        )
      : 0;

  if (
    duration <=
      EXCERPT_SECONDS + 8
  ) {
    return 0;
  }

  const minimumStart =
    Math.min(
      8,
      Math.max(
        0,
        duration -
          EXCERPT_SECONDS -
          1
      )
    );

  const maximumStart =
    Math.max(
      minimumStart,
      duration -
        EXCERPT_SECONDS -
        3
    );

  return (
    minimumStart +
    Math.random() *
      (
        maximumStart -
        minimumStart
      )
  );
}

function makeId(
  round: number,
  index: number,
  type: TriviaQuestionType
): string {
  return `${round}-${index}-${type}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function pickWrongArtist(
  artists: string[],
  correctArtist: string
): string {
  const correctKey =
    normalise(
      correctArtist
    );

  const candidates =
    artists.filter(
      (
        artist
      ) =>
        normalise(
          artist
        ) !== correctKey
    );

  return candidates.length
    ? randomItem(
        candidates
      )
    : "Another artist";
}

function buildArtistVerification(
  song: TriviaSong,
  artists: string[],
  round: number,
  index: number
): TriviaQuestion {
  const truthful =
    Math.random() >= 0.5;

  const displayedArtist =
    truthful
      ? clean(
          song.artist
        )
      : pickWrongArtist(
          artists,
          song.artist
        );

  return {
    id: makeId(
      round,
      index,
      "artist-verification"
    ),
    type:
      "artist-verification",
    prompt:
      `This song is by ${displayedArtist}, right?`,
    song,
    answerId:
      truthful
        ? "good"
        : "no-good",
    textOptions: [
      {
        id: "good",
        label: "Good",
      },
      {
        id: "no-good",
        label: "No Good",
      },
    ],
    shouldPlayAudio: true,
    excerptStart:
      randomExcerptStart(
        song
      ),
  };
}

function buildAlbumArtistVerification(
  song: TriviaSong,
  artists: string[],
  round: number,
  index: number
): TriviaQuestion {
  const truthful =
    Math.random() >= 0.5;

  const displayedArtist =
    truthful
      ? clean(
          song.artist
        )
      : pickWrongArtist(
          artists,
          song.artist
        );

  return {
    id: makeId(
      round,
      index,
      "album-artist-verification"
    ),
    type:
      "album-artist-verification",
    prompt:
      `Did ${displayedArtist} make this album?`,
    song,
    answerId:
      truthful
        ? "yay"
        : "nay",
    textOptions: [
      {
        id: "yay",
        label: "Yay",
      },
      {
        id: "nay",
        label: "Nay",
      },
    ],
    shouldPlayAudio: false,
    excerptStart: 0,
  };
}

function buildAlbumYearVerification(
  song: TriviaSong,
  years: number[],
  round: number,
  index: number
): TriviaQuestion {
  const actualYear =
    song.year as number;

  const truthful =
    Math.random() >= 0.5;

  const wrongYears =
    years.filter(
      (
        year
      ) =>
        year !== actualYear
    );

  const displayedYear =
    truthful ||
    wrongYears.length === 0
      ? actualYear
      : randomItem(
          wrongYears
        );

  return {
    id: makeId(
      round,
      index,
      "album-year-verification"
    ),
    type:
      "album-year-verification",
    prompt:
      `Do you think ${clean(song.album)} was released in ${displayedYear}?`,
    song,
    answerId:
      displayedYear ===
      actualYear
        ? "yes"
        : "no",
    textOptions: [
      {
        id: "yes",
        label: "Yes",
      },
      {
        id: "no",
        label: "No",
      },
    ],
    shouldPlayAudio: true,
    excerptStart:
      randomExcerptStart(
        song
      ),
  };
}

function buildAlbumArtIdentification(
  song: TriviaSong,
  artworkSongs: TriviaSong[],
  round: number,
  index: number
): TriviaQuestion {
  const correctAlbum =
    normalise(
      song.album
    );

  const distractors =
    shuffle(
      artworkSongs.filter(
        (
          candidate
        ) =>
          normalise(
            candidate.album
          ) !==
          correctAlbum
      )
    ).slice(0, 2);

  const options =
    shuffle([
      song,
      ...distractors,
    ]).map(
      (
        optionSong
      ) => ({
        id:
          optionSong.id,
        label:
          clean(
            optionSong.album
          ),
        image:
          optionSong.albumArt as string,
      })
    );

  return {
    id: makeId(
      round,
      index,
      "album-art-identification"
    ),
    type:
      "album-art-identification",
    prompt:
      `Which of these albums is ${clean(song.album)}?`,
    song,
    answerId:
      song.id,
    imageOptions:
      options,
    shouldPlayAudio: true,
    excerptStart:
      randomExcerptStart(
        song
      ),
  };
}

function buildSongArtistIdentification(
  song: TriviaSong,
  artists: string[],
  round: number,
  index: number
): TriviaQuestion {
  const correctArtist =
    clean(
      song.artist
    );

  const wrongArtists =
    shuffle(
      artists.filter(
        (
          artist
        ) =>
          normalise(
            artist
          ) !==
          normalise(
            correctArtist
          )
      )
    ).slice(0, 3);

  const options =
    shuffle([
      correctArtist,
      ...wrongArtists,
    ]).map(
      (
        artist
      ) => ({
        id:
          normalise(
            artist
          ),
        label:
          artist,
      })
    );

  return {
    id: makeId(
      round,
      index,
      "song-artist-identification"
    ),
    type:
      "song-artist-identification",
    prompt:
      `Which artist created ${clean(song.title)}?`,
    song,
    answerId:
      normalise(
        correctArtist
      ),
    textOptions:
      options,
    shouldPlayAudio: true,
    excerptStart:
      randomExcerptStart(
        song
      ),
  };
}

function buildAlbumYearIdentification(
  song: TriviaSong,
  yearAlbumSongs: TriviaSong[],
  round: number,
  index: number
): TriviaQuestion {
  const actualYear =
    song.year as number;

  const differentYears =
    uniqueBy(
      shuffle(
        yearAlbumSongs.filter(
          (
            candidate
          ) =>
            candidate.year !==
            actualYear &&
            normalise(
              candidate.album
            ) !==
            normalise(
              song.album
            )
        )
      ),
      (
        candidate
      ) =>
        String(
          candidate.year
        )
    ).slice(0, 3);

  const options =
    shuffle([
      song,
      ...differentYears,
    ]).map(
      (
        optionSong
      ) => ({
        id:
          optionSong.id,
        label:
          clean(
            optionSong.album
          ),
      })
    );

  return {
    id: makeId(
      round,
      index,
      "album-year-identification"
    ),
    type:
      "album-year-identification",
    prompt:
      `Which album was released in ${actualYear}?`,
    song,
    answerId:
      song.id,
    textOptions:
      options,
    shouldPlayAudio: false,
    excerptStart: 0,
  };
}

function buildPlayingAlbumArt(
  song: TriviaSong,
  artworkSongs: TriviaSong[],
  round: number,
  index: number
): TriviaQuestion {
  const correctAlbum =
    normalise(
      song.album
    );

  const distractors =
    shuffle(
      artworkSongs.filter(
        (
          candidate
        ) =>
          normalise(
            candidate.album
          ) !==
          correctAlbum
      )
    ).slice(0, 2);

  const options =
    shuffle([
      song,
      ...distractors,
    ]).map(
      (
        optionSong
      ) => ({
        id:
          optionSong.id,
        label:
          clean(
            optionSong.album
          ),
        image:
          optionSong.albumArt as string,
      })
    );

  return {
    id: makeId(
      round,
      index,
      "playing-album-art"
    ),
    type:
      "playing-album-art",
    prompt:
      "Know your music? Then which one is currently playing?",
    song,
    answerId:
      song.id,
    imageOptions:
      options,
    shouldPlayAudio: true,
    excerptStart:
      randomExcerptStart(
        song
      ),
  };
}

function generateRound(
  round: number,
  cloudSongs: TriviaSong[]
): TriviaRound | null {
  const artists =
    uniqueBy(
      cloudSongs
        .map(
          (
            song
          ) =>
            clean(
              song.artist
            )
        )
        .filter(
          validText
        ),
      normalise
    );

  const basicSongs =
    cloudSongs.filter(
      (
        song
      ) =>
        validText(
          song.title
        ) &&
        validText(
          song.artist
        ) &&
        validText(
          song.album
        ) &&
        Boolean(
          song.uri
        )
    );

  const artworkSongs =
    uniqueBy(
      basicSongs.filter(
        (
          song
        ) =>
          Boolean(
            song.albumArt
          )
      ),
      (
        song
      ) =>
        normalise(
          song.album
        )
    );

  const yearSongs =
    basicSongs.filter(
      (
        song
      ) =>
        validYear(
          song.year
        )
    );

  const yearAlbumSongs =
    uniqueBy(
      yearSongs,
      (
        song
      ) =>
        `${normalise(
          song.album
        )}|${song.year}`
    );

  const distinctYears =
    uniqueBy(
      yearAlbumSongs,
      (
        song
      ) =>
        String(
          song.year
        )
    );

  if (
    basicSongs.length < 7 ||
    artists.length < 4 ||
    artworkSongs.length < 3 ||
    yearSongs.length < 2 ||
    distinctYears.length < 4
  ) {
    return null;
  }

  const selectedBaseSongs =
    shuffle(
      basicSongs
    ).slice(
      0,
      QUESTIONS_PER_ROUND
    );

  const q1Song =
    selectedBaseSongs[0];

  const q2Candidates =
    artworkSongs.filter(
      (
        song
      ) =>
        song.id !==
        q1Song.id
    );

  const q2Song =
    q2Candidates.length
      ? randomItem(
          q2Candidates
        )
      : artworkSongs[0];

  const q3Candidates =
    yearSongs.filter(
      (
        song
      ) =>
        song.id !==
        q2Song.id
    );

  const q3Song =
    q3Candidates.length
      ? randomItem(
          q3Candidates
        )
      : yearSongs[0];

  const q4Candidates =
    artworkSongs.filter(
      (
        song
      ) =>
        song.id !==
        q2Song.id
    );

  const q4Song =
    q4Candidates.length
      ? randomItem(
          q4Candidates
        )
      : artworkSongs[0];

  const q5Song =
    selectedBaseSongs[4] ??
    randomItem(
      basicSongs
    );

  const q6Song =
    randomItem(
      distinctYears
    );

  const q7Candidates =
    artworkSongs.filter(
      (
        song
      ) =>
        song.id !==
        q4Song.id
    );

  const q7Song =
    q7Candidates.length
      ? randomItem(
          q7Candidates
        )
      : artworkSongs[0];

  const questions: TriviaQuestion[] =
    [
      buildArtistVerification(
        q1Song,
        artists,
        round,
        0
      ),
      buildAlbumArtistVerification(
        q2Song,
        artists,
        round,
        1
      ),
      buildAlbumYearVerification(
        q3Song,
        distinctYears.map(
          (
            song
          ) =>
            song.year as number
        ),
        round,
        2
      ),
      buildAlbumArtIdentification(
        q4Song,
        artworkSongs,
        round,
        3
      ),
      buildSongArtistIdentification(
        q5Song,
        artists,
        round,
        4
      ),
      buildAlbumYearIdentification(
        q6Song,
        distinctYears,
        round,
        5
      ),
      buildPlayingAlbumArt(
        q7Song,
        artworkSongs,
        round,
        6
      ),
    ];

  /*
   * Later rounds keep the same seven reliable
   * question families, but shuffle their order.
   * This keeps the game familiar while the time
   * limit becomes progressively harder.
   */
  return {
    round,
    secondsPerQuestion:
      ROUND_TIMERS[
        round - 1
      ],
    questions:
      round === 1
        ? questions
        : shuffle(
            questions
          ),
  };
}

async function preloadImage(
  source:
    | string
    | undefined
): Promise<void> {
  if (!source) {
    return;
  }

  await new Promise<void>(
    (
      resolve
    ) => {
      const image =
        new Image();

      image.onload =
        () =>
          resolve();

      image.onerror =
        () =>
          resolve();

      image.src =
        source;
    }
  );
}

async function preloadAudio(
  song:
    | TriviaSong
    | undefined
): Promise<void> {
  if (
    !song?.uri
  ) {
    return;
  }

  await new Promise<void>(
    (
      resolve
    ) => {
      const audio =
        new Audio();

      const finish =
        (): void => {
          audio.removeEventListener(
            "canplay",
            finish
          );

          audio.removeEventListener(
            "error",
            finish
          );

          audio.src = "";
          resolve();
        };

      audio.preload =
        "auto";

      audio.addEventListener(
        "canplay",
        finish,
        {
          once: true,
        }
      );

      audio.addEventListener(
        "error",
        finish,
        {
          once: true,
        }
      );

      audio.src =
        song.uri;

      audio.load();

      window.setTimeout(
        finish,
        2500
      );
    }
  );
}

function formatScore(
  correctAnswers: number,
  answeredQuestions: number
): number {
  if (
    answeredQuestions <= 0
  ) {
    return 0;
  }

  return Math.round(
    (
      correctAnswers /
      answeredQuestions
    ) *
      100
  );
}

export function MusicTriviaScreen({
  onBack,
}: Props) {
  const {
    songs,
    isPlaying,
    togglePlay,
  } = usePlayer();

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const answerTimerRef =
    useRef<number | null>(
      null
    );

  const roundIntroTimerRef =
    useRef<number | null>(
      null
    );

  const normalPlaybackWasPlayingRef =
    useRef<boolean>(
      false
    );

  const mountedRef =
    useRef<boolean>(
      true
    );

  const [
    phase,
    setPhase,
  ] = useState<GamePhase>(
    "loading"
  );

  const [
    rounds,
    setRounds,
  ] = useState<
    TriviaRound[]
  >([]);

  const [
    roundIndex,
    setRoundIndex,
  ] = useState<number>(
    0
  );

  const [
    questionIndex,
    setQuestionIndex,
  ] = useState<number>(
    0
  );

  const [
    lives,
    setLives,
  ] = useState<number>(
    MAX_LIVES
  );

  const [
    timeLeft,
    setTimeLeft,
  ] = useState<number>(
    ROUND_TIMERS[0]
  );

  const [
    selectedAnswerId,
    setSelectedAnswerId,
  ] = useState<
    string | null
  >(null);

  const [
    answerState,
    setAnswerState,
  ] = useState<AnswerState>(
    "idle"
  );

  const [
    correctAnswers,
    setCorrectAnswers,
  ] = useState<number>(
    0
  );

  const [
    answeredQuestions,
    setAnsweredQuestions,
  ] = useState<number>(
    0
  );

  const [
    loadingLabel,
    setLoadingLabel,
  ] = useState<string>(
    "Loading your music..."
  );

  const cloudSongs =
    useMemo(
      () =>
        songs.filter(
          (
            song
          ): song is TriviaSong =>
            song.source ===
              "cloudinary" &&
            Boolean(
              song.uri
            )
        ),
      [songs]
    );

  const currentRound =
    rounds[
      roundIndex
    ];

  const currentQuestion =
    currentRound
      ?.questions[
        questionIndex
      ];

  const stopTriviaAudio =
    useCallback(
      (): void => {
        const audio =
          audioRef.current;

        if (!audio) {
          return;
        }

        audio.pause();
        audio.removeAttribute(
          "src"
        );

        try {
          audio.load();
        } catch {
          // Ignore browser cleanup errors.
        }

        audioRef.current =
          null;
      },
      []
    );

  const playQuestionAudio =
    useCallback(
      async (
        question:
          TriviaQuestion
      ): Promise<void> => {
        stopTriviaAudio();

        if (
          !question
            .shouldPlayAudio
        ) {
          return;
        }

        /*
         * IMPORTANT:
         * The audio URI comes from question.song itself.
         * The displayed artist/album statement may be
         * true or deliberately false, but the excerpt is
         * always from this exact underlying song record.
         */
        const audio =
          new Audio(
            question.song.uri
          );

        audio.preload =
          "auto";

        audioRef.current =
          audio;

        const startPlayback =
          async (): Promise<void> => {
            try {
              const duration =
                Number.isFinite(
                  audio.duration
                )
                  ? audio.duration
                  : question.song
                      .duration;

              const safeStart =
                Math.min(
                  Math.max(
                    0,
                    question
                      .excerptStart
                  ),
                  Math.max(
                    0,
                    duration -
                      EXCERPT_SECONDS -
                      1
                  )
                );

              audio.currentTime =
                safeStart;

              await audio.play();

              window.setTimeout(
                () => {
                  if (
                    audioRef.current ===
                    audio
                  ) {
                    audio.pause();
                  }
                },
                EXCERPT_SECONDS *
                  1000
              );
            } catch (error) {
              console.warn(
                "Unable to play Music Trivia excerpt:",
                error
              );
            }
          };

        if (
          audio.readyState >=
          1
        ) {
          await startPlayback();
          return;
        }

        audio.addEventListener(
          "loadedmetadata",
          () => {
            void startPlayback();
          },
          {
            once: true,
          }
        );

        audio.load();
      },
      [
        stopTriviaAudio,
      ]
    );

  const resetAnswerState =
    useCallback(
      (): void => {
        setSelectedAnswerId(
          null
        );

        setAnswerState(
          "idle"
        );
      },
      []
    );

  const startRound =
    useCallback(
      (
        nextRoundIndex:
          number
      ): void => {
        const nextRound =
          rounds[
            nextRoundIndex
          ];

        if (!nextRound) {
          setPhase(
            "winner"
          );
          stopTriviaAudio();
          return;
        }

        setRoundIndex(
          nextRoundIndex
        );

        setQuestionIndex(
          0
        );

        setTimeLeft(
          nextRound
            .secondsPerQuestion
        );

        resetAnswerState();

        setPhase(
          "round-intro"
        );

        if (
          roundIntroTimerRef
            .current !== null
        ) {
          window.clearTimeout(
            roundIntroTimerRef
              .current
          );
        }

        roundIntroTimerRef.current =
          window.setTimeout(
            () => {
              if (
                !mountedRef.current
              ) {
                return;
              }

              setPhase(
                "question"
              );
            },
            ROUND_INTRO_MS
          );
      },
      [
        resetAnswerState,
        rounds,
        stopTriviaAudio,
      ]
    );

  const moveNext =
    useCallback(
      (): void => {
        stopTriviaAudio();

        const round =
          rounds[
            roundIndex
          ];

        if (!round) {
          return;
        }

        const nextQuestionIndex =
          questionIndex +
          1;

        if (
          nextQuestionIndex <
          round.questions.length
        ) {
          setQuestionIndex(
            nextQuestionIndex
          );

          setTimeLeft(
            round
              .secondsPerQuestion
          );

          resetAnswerState();
          return;
        }

        const nextRoundIndex =
          roundIndex +
          1;

        if (
          nextRoundIndex >=
          rounds.length
        ) {
          setPhase(
            "winner"
          );
          return;
        }

        startRound(
          nextRoundIndex
        );
      },
      [
        questionIndex,
        resetAnswerState,
        roundIndex,
        rounds,
        startRound,
        stopTriviaAudio,
      ]
    );

  const scheduleMoveNext =
    useCallback(
      (): void => {
        if (
          answerTimerRef
            .current !== null
        ) {
          window.clearTimeout(
            answerTimerRef
              .current
          );
        }

        answerTimerRef.current =
          window.setTimeout(
            moveNext,
            ANSWER_TRANSITION_MS
          );
      },
      [
        moveNext,
      ]
    );

  const loseLife =
    useCallback(
      (
        nextState:
          "wrong" |
          "timeout"
      ): boolean => {
        const nextLives =
          lives - 1;

        setLives(
          Math.max(
            0,
            nextLives
          )
        );

        setAnswerState(
          nextState
        );

        if (
          nextLives <= 0
        ) {
          if (
            answerTimerRef
              .current !== null
          ) {
            window.clearTimeout(
              answerTimerRef
                .current
            );
          }

          answerTimerRef.current =
            window.setTimeout(
              () => {
                stopTriviaAudio();
                setPhase(
                  "game-over"
                );
              },
              ANSWER_TRANSITION_MS
            );

          return true;
        }

        return false;
      },
      [
        lives,
        stopTriviaAudio,
      ]
    );

  const handleAnswer =
    useCallback(
      (
        answerId: string
      ): void => {
        if (
          phase !==
            "question" ||
          answerState !==
            "idle" ||
          !currentQuestion
        ) {
          return;
        }

        stopTriviaAudio();

        setSelectedAnswerId(
          answerId
        );

        setAnsweredQuestions(
          (
            current
          ) =>
            current + 1
        );

        if (
          answerId ===
          currentQuestion
            .answerId
        ) {
          setAnswerState(
            "correct"
          );

          setCorrectAnswers(
            (
              current
            ) =>
              current + 1
          );

          scheduleMoveNext();
          return;
        }

        const gameEnded =
          loseLife(
            "wrong"
          );

        if (!gameEnded) {
          scheduleMoveNext();
        }
      },
      [
        answerState,
        currentQuestion,
        loseLife,
        phase,
        scheduleMoveNext,
        stopTriviaAudio,
      ]
    );

  const restartGame =
    useCallback(
      (): void => {
        stopTriviaAudio();

        setLives(
          MAX_LIVES
        );

        setCorrectAnswers(
          0
        );

        setAnsweredQuestions(
          0
        );

        setRoundIndex(
          0
        );

        setQuestionIndex(
          0
        );

        resetAnswerState();

        setPhase(
          "loading"
        );
      },
      [
        resetAnswerState,
        stopTriviaAudio,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    /*
     * Keep the normal player queue/current song untouched.
     * We only pause it while the dedicated trivia audio
     * player is active, then restore playback on exit if
     * it had been playing before Trivia opened.
     */
    normalPlaybackWasPlayingRef.current =
      isPlaying;

    if (isPlaying) {
      togglePlay();
    }

    return () => {
      stopTriviaAudio();

      if (
        normalPlaybackWasPlayingRef.current
      ) {
        togglePlay();
      }
    };
    // Run only for the lifetime of this game screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (
        answerTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          answerTimerRef.current
        );
      }

      if (
        roundIntroTimerRef
          .current !== null
      ) {
        window.clearTimeout(
          roundIntroTimerRef
            .current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      phase !==
      "loading"
    ) {
      return;
    }

    let cancelled =
      false;

    async function prepareGame():
      Promise<void> {
      const loadingStartedAt =
        Date.now();

      setLoadingLabel(
        "Loading your music..."
      );

      await new Promise<void>(
        (
          resolve
        ) =>
          window.setTimeout(
            resolve,
            180
          )
      );

      if (
        cancelled
      ) {
        return;
      }

      setLoadingLabel(
        "Building your rounds..."
      );

      const generatedRounds:
        TriviaRound[] = [];

      for (
        let round = 1;
        round <= 5;
        round += 1
      ) {
        const generated =
          generateRound(
            round,
            cloudSongs
          );

        if (!generated) {
          setPhase(
            "not-enough-music"
          );
          return;
        }

        generatedRounds.push(
          generated
        );
      }

      if (
        cancelled
      ) {
        return;
      }

      setLoadingLabel(
        "Shuffling questions..."
      );

      const firstRound =
        generatedRounds[0];

      const firstQuestion =
        firstRound
          ?.questions[0];

      const firstArtwork =
        firstRound
          ?.questions
          .flatMap(
            (
              question
            ) =>
              question
                .imageOptions ??
              []
          )
          .slice(
            0,
            6
          );

      await Promise.all([
        ...(
          firstArtwork ??
          []
        ).map(
          (
            option
          ) =>
            preloadImage(
              option.image
            )
        ),
        preloadAudio(
          firstQuestion
            ?.shouldPlayAudio
            ? firstQuestion.song
            : undefined
        ),
      ]);

      if (
        cancelled
      ) {
        return;
      }

      const elapsed =
        Date.now() -
        loadingStartedAt;

      if (
        elapsed <
        MIN_LOADING_MS
      ) {
        await new Promise<void>(
          (
            resolve
          ) =>
            window.setTimeout(
              resolve,
              MIN_LOADING_MS -
                elapsed
            )
        );
      }

      if (
        cancelled
      ) {
        return;
      }

      setRounds(
        generatedRounds
      );

      setRoundIndex(
        0
      );

      setQuestionIndex(
        0
      );

      setTimeLeft(
        generatedRounds[0]
          .secondsPerQuestion
      );

      setPhase(
        "round-intro"
      );
    }

    void prepareGame();

    return () => {
      cancelled =
        true;
    };
  }, [
    cloudSongs,
    phase,
  ]);

  useEffect(() => {
    if (
      phase !==
        "round-intro" ||
      rounds.length === 0
    ) {
      return;
    }

    if (
      roundIntroTimerRef
        .current !== null
    ) {
      window.clearTimeout(
        roundIntroTimerRef
          .current
      );
    }

    roundIntroTimerRef.current =
      window.setTimeout(
        () => {
          setPhase(
            "question"
          );
        },
        ROUND_INTRO_MS
      );

    return () => {
      if (
        roundIntroTimerRef
          .current !== null
      ) {
        window.clearTimeout(
          roundIntroTimerRef
            .current
        );
      }
    };
  }, [
    phase,
    roundIndex,
    rounds.length,
  ]);

  useEffect(() => {
    if (
      phase !==
        "question" ||
      !currentQuestion ||
      answerState !==
        "idle"
    ) {
      return;
    }

    setTimeLeft(
      currentRound
        .secondsPerQuestion
    );

    void playQuestionAudio(
      currentQuestion
    );
  }, [
    answerState,
    currentQuestion,
    currentRound,
    phase,
    playQuestionAudio,
  ]);

  useEffect(() => {
    if (
      phase !==
        "question" ||
      answerState !==
        "idle" ||
      !currentQuestion
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          setTimeLeft(
            (
              current
            ) => {
              if (
                current <= 1
              ) {
                window.clearInterval(
                  interval
                );

                stopTriviaAudio();

                setAnsweredQuestions(
                  (
                    answered
                  ) =>
                    answered + 1
                );

                const gameEnded =
                  loseLife(
                    "timeout"
                  );

                if (
                  !gameEnded
                ) {
                  scheduleMoveNext();
                }

                return 0;
              }

              return (
                current - 1
              );
            }
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    answerState,
    currentQuestion,
    loseLife,
    phase,
    scheduleMoveNext,
    stopTriviaAudio,
  ]);

  const timerPercentage =
    currentRound
      ? Math.max(
          0,
          Math.min(
            100,
            (
              timeLeft /
              currentRound
                .secondsPerQuestion
            ) *
              100
          )
        )
      : 100;

  const accuracy =
    formatScore(
      correctAnswers,
      answeredQuestions
    );

  function answerClass(
    optionId: string
  ): string {
    if (
      answerState ===
      "idle"
    ) {
      return "border-white/10 bg-white/[0.055] text-white active:scale-[0.985]";
    }

    if (
      currentQuestion &&
      optionId ===
        currentQuestion
          .answerId
    ) {
      return "border-[#1DB954]/70 bg-[#1DB954]/20 text-white";
    }

    if (
      optionId ===
        selectedAnswerId
    ) {
      return "border-red-500/70 bg-red-500/20 text-white";
    }

    return "border-white/5 bg-white/[0.025] text-white/45";
  }

  return (
    <motion.div
      className="fixed inset-0 z-[130] overflow-hidden bg-[#090909] text-white"
      initial={{
        opacity: 0,
        scale: 1.015,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.99,
      }}
      transition={{
        duration: 0.28,
        ease: [
          0.22,
          1,
          0.36,
          1,
        ],
      }}
    >
      <AnimatePresence
        mode="wait"
      >
        {phase ===
        "loading" ? (
          <motion.div
            key="loading"
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.98,
            }}
            transition={{
              duration: 0.3,
            }}
          >
            <button
              type="button"
              onClick={onBack}
              aria-label="Exit Music Trivia"
              className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white"
            >
              <ArrowLeftIcon
                size={23}
              />
            </button>

            <motion.div
              className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]"
              animate={{
                scale: [
                  1,
                  1.06,
                  1,
                ],
              }}
              transition={{
                duration: 1.8,
                repeat:
                  Infinity,
                ease:
                  "easeInOut",
              }}
            >
              <motion.div
                className="absolute inset-2 rounded-full border border-[#1DB954]/30"
                animate={{
                  rotate: 360,
                }}
                transition={{
                  duration: 3.2,
                  repeat:
                    Infinity,
                  ease:
                    "linear",
                }}
              />

              <Music2Icon
                size={38}
                className="text-[#1DB954]"
              />
            </motion.div>

            <h1 className="mt-7 text-3xl font-black tracking-tight">
              Music Trivia
            </h1>

            <p className="mt-3 text-sm font-semibold text-neutral-300">
              Preparing your game
            </p>

            <AnimatePresence
              mode="wait"
            >
              <motion.p
                key={
                  loadingLabel
                }
                className="mt-2 text-xs text-neutral-500"
                initial={{
                  opacity: 0,
                  y: 5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -5,
                }}
              >
                {loadingLabel}
              </motion.p>
            </AnimatePresence>

            <div className="mt-7 flex items-center gap-2 text-neutral-500">
              <LoaderCircleIcon
                size={17}
                className="animate-spin"
              />

              <span className="text-xs">
                Cloudinary catalogue
              </span>
            </div>
          </motion.div>
        ) : phase ===
          "not-enough-music" ? (
          <motion.div
            key="not-enough"
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            initial={{
              opacity: 0,
              y: 16,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <Music2Icon
              size={48}
              className="text-neutral-600"
            />

            <h1 className="mt-5 text-2xl font-black">
              More music needed
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-6 text-neutral-400">
              Music Trivia needs enough Cloudinary songs with artist, album, year and album-art metadata to create fair questions without duplicate answers.
            </p>

            <button
              type="button"
              onClick={onBack}
              className="mt-7 rounded-full bg-white px-6 py-3 text-sm font-black text-black active:scale-95"
            >
              Back
            </button>
          </motion.div>
        ) : phase ===
          "round-intro" ? (
          <motion.div
            key={`round-${roundIndex}`}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            initial={{
              opacity: 0,
              scale: 0.94,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 1.05,
            }}
            transition={{
              duration: 0.34,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
          >
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#1DB954]">
              Get ready
            </p>

            <h1 className="mt-3 text-6xl font-black">
              Round{" "}
              {roundIndex +
                1}
            </h1>

            <p className="mt-4 text-base text-neutral-400">
              {
                ROUND_TIMERS[
                  roundIndex
                ]
              }{" "}
              seconds per question
            </p>

            <div className="mt-7 flex gap-2">
              {Array.from({
                length:
                  MAX_LIVES,
              }).map(
                (
                  _,
                  index
                ) => (
                  <HeartIcon
                    key={
                      index
                    }
                    size={24}
                    fill={
                      index <
                      lives
                        ? "currentColor"
                        : "none"
                    }
                    className={
                      index <
                      lives
                        ? "text-red-500"
                        : "text-neutral-700"
                    }
                  />
                )
              )}
            </div>
          </motion.div>
        ) : phase ===
          "question" &&
          currentQuestion &&
          currentRound ? (
          <motion.div
            key={
              currentQuestion.id
            }
            className="absolute inset-0 flex flex-col"
            initial={{
              opacity: 0,
              x: 28,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -28,
            }}
            transition={{
              duration: 0.3,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
          >
            <header className="flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onBack}
                aria-label="Exit Music Trivia"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5"
              >
                <ArrowLeftIcon
                  size={23}
                />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
                    Round{" "}
                    {roundIndex +
                      1} / 5
                  </span>

                  <span className="text-xs font-bold text-neutral-400">
                    Question{" "}
                    {questionIndex +
                      1} / 7
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-[#1DB954]"
                    animate={{
                      width:
                        `${timerPercentage}%`,
                    }}
                    transition={{
                      duration: 0.25,
                      ease:
                        "linear",
                    }}
                  />
                </div>
              </div>

              <div
                className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-sm font-black ${
                  timeLeft <=
                  5
                    ? "bg-red-500/20 text-red-400"
                    : "bg-white/5 text-white"
                }`}
              >
                {timeLeft}
              </div>
            </header>

            <div className="flex items-center justify-center gap-2 px-5 pt-1">
              {Array.from({
                length:
                  MAX_LIVES,
              }).map(
                (
                  _,
                  index
                ) => (
                  <motion.div
                    key={
                      index
                    }
                    animate={
                      index ===
                        lives &&
                      (
                        answerState ===
                          "wrong" ||
                        answerState ===
                          "timeout"
                      )
                        ? {
                            scale: [
                              1,
                              1.35,
                              0.75,
                              1,
                            ],
                            opacity: [
                              1,
                              1,
                              0.3,
                              1,
                            ],
                          }
                        : {}
                    }
                  >
                    <HeartIcon
                      size={21}
                      fill={
                        index <
                        lives
                          ? "currentColor"
                          : "none"
                      }
                      className={
                        index <
                        lives
                          ? "text-red-500"
                          : "text-neutral-700"
                      }
                    />
                  </motion.div>
                )
              )}
            </div>

            <main className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-5">
              {currentQuestion
                .type ===
                "album-artist-verification" &&
              currentQuestion.song
                .albumArt ? (
                <motion.div
                  className="mx-auto mb-6 aspect-square w-[min(58vw,240px)] overflow-hidden rounded-2xl bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                  initial={{
                    opacity: 0,
                    scale: 0.94,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                >
                  <img
                    src={
                      currentQuestion
                        .song
                        .albumArt
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              ) : null}

              {currentQuestion
                .shouldPlayAudio ? (
                <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-bold text-neutral-300">
                  <motion.span
                    className="flex items-end gap-0.5"
                    aria-hidden="true"
                  >
                    {[0, 1, 2, 3].map(
                      (
                        bar
                      ) => (
                        <motion.span
                          key={
                            bar
                          }
                          className="w-0.5 rounded-full bg-[#1DB954]"
                          animate={{
                            height: [
                              5,
                              14 -
                                bar *
                                  2,
                              7,
                              12,
                              5,
                            ],
                          }}
                          transition={{
                            duration:
                              0.8 +
                              bar *
                                0.08,
                            repeat:
                              Infinity,
                            ease:
                              "easeInOut",
                          }}
                        />
                      )
                    )}
                  </motion.span>

                  Playing random excerpt
                </div>
              ) : null}

              <h1 className="mx-auto max-w-xl text-center text-[26px] font-black leading-[1.15] tracking-tight text-white">
                {
                  currentQuestion
                    .prompt
                }
              </h1>

              {currentQuestion
                .imageOptions ? (
                <div
                  className={`mx-auto mt-8 grid max-w-xl gap-3 ${
                    currentQuestion
                      .imageOptions
                      .length === 3
                      ? "grid-cols-3"
                      : "grid-cols-2"
                  }`}
                >
                  {currentQuestion
                    .imageOptions
                    .map(
                      (
                        option
                      ) => (
                        <motion.button
                          key={
                            option.id
                          }
                          type="button"
                          disabled={
                            answerState !==
                            "idle"
                          }
                          onClick={() =>
                            handleAnswer(
                              option.id
                            )
                          }
                          className={`overflow-hidden rounded-2xl border text-left transition ${answerClass(
                            option.id
                          )}`}
                          whileTap={
                            answerState ===
                            "idle"
                              ? {
                                  scale:
                                    0.97,
                                }
                              : undefined
                          }
                        >
                          <span className="block aspect-square overflow-hidden bg-white/5">
                            <img
                              src={
                                option.image
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </span>

                          <span className="block truncate px-2 py-2 text-center text-[11px] font-bold">
                            {
                              option.label
                            }
                          </span>
                        </motion.button>
                      )
                    )}
                </div>
              ) : (
                <div className="mx-auto mt-8 grid max-w-lg grid-cols-1 gap-3">
                  {currentQuestion
                    .textOptions
                    ?.map(
                      (
                        option
                      ) => (
                        <motion.button
                          key={
                            option.id
                          }
                          type="button"
                          disabled={
                            answerState !==
                            "idle"
                          }
                          onClick={() =>
                            handleAnswer(
                              option.id
                            )
                          }
                          className={`min-h-14 rounded-2xl border px-5 py-4 text-center text-base font-extrabold transition ${answerClass(
                            option.id
                          )}`}
                          whileTap={
                            answerState ===
                            "idle"
                              ? {
                                  scale:
                                    0.985,
                                }
                              : undefined
                          }
                        >
                          {
                            option.label
                          }
                        </motion.button>
                      )
                    )}
                </div>
              )}

              <AnimatePresence>
                {answerState !==
                "idle" ? (
                  <motion.div
                    className={`mx-auto mt-6 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${
                      answerState ===
                      "correct"
                        ? "bg-[#1DB954]/15 text-[#1DB954]"
                        : "bg-red-500/15 text-red-400"
                    }`}
                    initial={{
                      opacity: 0,
                      y: 8,
                      scale:
                        0.94,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                    }}
                  >
                    {answerState ===
                    "correct" ? (
                      <>
                        <CheckIcon
                          size={18}
                        />
                        Correct!
                      </>
                    ) : answerState ===
                      "timeout" ? (
                      <>
                        <XIcon
                          size={18}
                        />
                        Time&apos;s up
                      </>
                    ) : (
                      <>
                        <XIcon
                          size={18}
                        />
                        Wrong answer
                      </>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </main>
          </motion.div>
        ) : phase ===
          "game-over" ? (
          <motion.div
            key="game-over"
            className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center"
            initial={{
              opacity: 0,
              scale: 0.92,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.38,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <XIcon
                size={42}
                className="text-red-500"
              />
            </div>

            <h1 className="mt-6 text-4xl font-black">
              Game Over
            </h1>

            <p className="mt-3 text-sm text-neutral-400">
              Round{" "}
              {roundIndex + 1}
              {" · "}
              Question{" "}
              {questionIndex +
                1} of 7
            </p>

            <div className="mt-7 grid w-full max-w-sm grid-cols-2 gap-3">
              <ResultStat
                label="Correct"
                value={
                  String(
                    correctAnswers
                  )
                }
              />

              <ResultStat
                label="Accuracy"
                value={`${accuracy}%`}
              />
            </div>

            <button
              type="button"
              onClick={
                restartGame
              }
              className="mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-black text-black active:scale-[0.985]"
            >
              <RotateCcwIcon
                size={18}
              />

              Try Again
            </button>

            <button
              type="button"
              onClick={onBack}
              className="mt-3 w-full max-w-sm rounded-full px-5 py-3 text-sm font-bold text-neutral-300 active:bg-white/5"
            >
              Exit
            </button>
          </motion.div>
        ) : phase ===
          "winner" ? (
          <motion.div
            key="winner"
            className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center"
            initial={{
              opacity: 0,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              type:
                "spring",
              stiffness: 220,
              damping: 22,
            }}
          >
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-full bg-[#1DB954]/15"
              initial={{
                rotate: -8,
                scale: 0.7,
              }}
              animate={{
                rotate: 0,
                scale: 1,
              }}
            >
              <TrophyIcon
                size={50}
                className="text-[#1DB954]"
              />
            </motion.div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.22em] text-[#1DB954]">
              All 5 rounds complete
            </p>

            <h1 className="mt-2 text-5xl font-black tracking-tight">
              You Win
            </h1>

            <p className="mt-3 text-sm text-neutral-400">
              You completed Music Trivia.
            </p>

            <div className="mt-7 grid w-full max-w-sm grid-cols-3 gap-3">
              <ResultStat
                label="Correct"
                value={`${correctAnswers}/35`}
              />

              <ResultStat
                label="Accuracy"
                value={`${accuracy}%`}
              />

              <ResultStat
                label="Lives"
                value={
                  String(
                    lives
                  )
                }
              />
            </div>

            <button
              type="button"
              onClick={
                restartGame
              }
              className="mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#1DB954] px-5 py-3.5 text-sm font-black text-black active:scale-[0.985]"
            >
              <RotateCcwIcon
                size={18}
              />

              Play Again
            </button>

            <button
              type="button"
              onClick={onBack}
              className="mt-3 w-full max-w-sm rounded-full px-5 py-3 text-sm font-bold text-neutral-300 active:bg-white/5"
            >
              Back to Home
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-4">
      <p className="text-xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
    </div>
  );
}

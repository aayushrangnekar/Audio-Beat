# Audio Beat

Audio Beat is a music player application built with React, TypeScript, Capacitor, Kotlin, and Android Media3. It combines local Android music playback with a Cloudinary-backed music catalogue and includes playlists, liked songs, recently played history, top artists, synchronized lyrics, video backgrounds, offline caching, Android Auto support, audio-output detection, and an interactive Music Trivia game (still in development).


## Project Overview

| **Area** | **Details** |
| :--- | :--- |
| **App name** | Audio Beat |
| **Platform** | Android |
| **Frontend** | React + TypeScript + Vite |
| **Native layer** | Capacitor + Kotlin |
| **Playback engine** | Android Media3 / ExoPlayer |
| **Cloud catalogue** | Cloudinary |
| **Backend/API** | Netlify Functions |
| **Lyrics** | LRCLIB |
| **Artist images** | TheAudioDB |
| **Android Auto** | **Supported - native media browsing and playback through the car interface** |
| **Offline support** | Catalogue, artwork, artist images, cloud-audio cache and downloaded video reuse |

## Features

- **Local Android music playback**
- **Cloudinary-backed music catalogue**
- **Background playback using Android Media3**
- Native media controls and playback notification
- **Android Auto media browsing and playback**
- Recently Played
- Most Played
- Top Artists
- Liked Songs
- User-created playlists
- Album browsing
- Search
- **Synced lyrics through LRCLIB**
- **Artist images through TheAudioDB**
- Album artwork support
- Optional song video background canvas
- Bluetooth / audio-output detection
- **Offline catalogue and artwork support**
- **Cloud audio & video caching**
- **Music Trivia based on songs in the Cloudinary catalogue**
- Smooth animated UI using Framer Motion

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React
- Sonner

### Android

- Capacitor
- Kotlin
- Android Media3
- ExoPlayer
- MediaSession / MediaLibrarySession
- Android Auto integration

### Cloud and external services

- Cloudinary - songs, album artwork and optional song videos
- Netlify Functions - backend catalogue/API layer
- LRCLIB - time synchronized lyrics
- TheAudioDB - artist images

## Android Compatibility and Native Configuration

### Android SDK configuration

**The Android application uses the package/namespace:**

```text
com.audio.beat.app
```

**The current Android build targets:**

| **Android setting** | **Current value** |
| :--- | :--- |
| **Target SDK** | API 36 |
| **Target Android version** | Android 16 |
| **Application ID** | `com.audio.beat.app` |
| **Version** | `1.0` |
| **Java target** | 21 |
| **Kotlin JVM target** | 21 |
| **Media3** | 1.10.1 |

The app-level Gradle file obtains the SDK values from the root Android project:

```gradle
compileSdk = rootProject.ext.compileSdkVersion

minSdkVersion rootProject.ext.minSdkVersion
targetSdkVersion rootProject.ext.targetSdkVersion
```

The current app build has been observed running with `targetSdkVersion=36`.

The exact minimum installable Android version is controlled by:

```text
rootProject.ext.minSdkVersion
```

in the Android root configuration (normally `android/variables.gradle`). When documenting or changing the minimum supported Android version, use that value as the source of truth instead of changing only `android/app/build.gradle`.

The application is designed to handle newer Android permission models while retaining compatibility logic for older Android releases.

---

### Android permissions

**Audio Beat declares only the Android permissions required for networking, local music discovery, external audio-output information, notifications and foreground media playback.**

| **Permission** | **Android relevance** | **Why Audio Beat needs it** |
| :--- | :--- | :--- |
| `android.permission.INTERNET` | All supported Android versions | Connects to the Netlify backend, streams Cloudinary media, retrieves LRCLIB lyrics, downloads artwork and obtains artist images. |
| `android.permission.READ_MEDIA_AUDIO` | Android 13+ / API 33+ | Allows the local music scanner to read audio files exposed by Android's media store. |
| `android.permission.READ_EXTERNAL_STORAGE` | Android 12L / API 32 and below | Legacy local-audio access for Android versions before `READ_MEDIA_AUDIO`. The manifest limits this permission with `maxSdkVersion="32"`. |
| `android.permission.BLUETOOTH_CONNECT` | Android 12+ / API 31+ | Allows the app to inspect connected Bluetooth audio devices and display the active external output. |
| `android.permission.FOREGROUND_SERVICE` | Android foreground playback | Allows the native Media3 playback service to continue running while the app is backgrounded. |
| `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Newer Android versions | Declares that the foreground service is specifically performing media playback. |
| `android.permission.POST_NOTIFICATIONS` | Android 13+ / API 33+ | Allows notification-related UI where required by the Android notification permission model. |

#### Runtime permission behaviour

**Not every manifest permission produces a user prompt.**

The important runtime permissions are primarily:

```text
READ_MEDIA_AUDIO
READ_EXTERNAL_STORAGE (older Android)
BLUETOOTH_CONNECT
POST_NOTIFICATIONS
```

The app handles Android-version differences so that it does not request a permission that does not exist on that Android release.

For example:

```text
Android 13+
    → READ_MEDIA_AUDIO

Android 12L and below
    → READ_EXTERNAL_STORAGE where required

Android 12+
    → BLUETOOTH_CONNECT for Bluetooth device information
```

The audio-output plugin checks the Android version before requesting Bluetooth permission.

Audio Beat does **not** require microphone access to play music and does not need permissions such as camera, contacts or location for its normal music-player functionality.

---

### Native Android components

The React application communicates with native Android code through Capacitor plugins.

Important native components include:

```text
MainActivity
MusicScannerPlugin
AudioPlayerPlugin
AudioOutputPlugin
VideoStoragePlugin
AndroidAutoLibraryPlugin
MusicPlaybackService
```

Their responsibilities are approximately:

| **Component** | **Responsibility** |
| :--- | :--- |
| `MusicScannerPlugin` | Reads songs available through the Android media store. |
| `AudioPlayerPlugin` | Connects React playback commands to the native Media3 controller/session. |
| `MusicPlaybackService` | Owns ExoPlayer/Media3 playback, the media session and background audio lifecycle. |
| `AudioOutputPlugin` | Reports active external audio outputs such as Bluetooth, wired, USB or car audio. |
| `VideoStoragePlugin` | Downloads, stores and reuses song video backgrounds locally. |
| `AndroidAutoLibraryPlugin` | Synchronizes library data needed by Android Auto into native persistent storage. |

---

### Media3 playback architecture

**Audio Beat uses Android Media3 rather than playing the main music queue through an HTML `<audio>` element.**

```text
React UI
   ↓
PlayerContext
   ↓
AudioPlayer TypeScript bridge
   ↓
AudioPlayerPlugin.kt
   ↓
MediaController
   ↓
MusicPlaybackService
   ↓
Media3 / ExoPlayer
```

This architecture provides:

- playback when the React WebView is not in the foreground;
- lock-screen/media notification controls;
- Next / Previous support;
- media-session integration;
- Android Auto compatibility;
- Android audio-focus handling;
- pause-on-headphone/Bluetooth-disconnect behaviour.

The player uses media/music audio attributes and handles the Android "audio becoming noisy" event.

---

### Native Cloudinary audio cache

The native playback service maintains a persistent Media3 cache for Cloudinary-delivered audio.

Current configured maximum:

```text
500 MB
```

Cache directory:

```text
cloudinary_audio_cache
```

Cloud-delivered media is routed through the Media3 cache while local/content/file media continues through the normal local data-source path.

This avoids copying local songs into the Cloudinary cache and allows previously streamed cloud audio to be reused when available.

---

## Why Netlify Is Connected

**Netlify is not just used for hosting. It acts as the backend/API security boundary between the Audio Beat client and Cloudinary's administrative API.**

### The problem with connecting the app directly to Cloudinary administration

**The Android/React application must never contain privileged credentials such as:**

```text
CLOUDINARY_API_SECRET
private Cloudinary management credentials
server-side access tokens
```

Anything bundled into a React/Capacitor application can ultimately be inspected on a user's device.

Therefore this architecture would be unsafe:

```text
Android app
    ↓
Cloudinary Admin API
    ↓
API secret embedded inside app
```

Audio Beat instead uses:

```text
Android / React client
        ↓
Netlify backend
        ↓
Cloudinary administrative API
```

**The Netlify environment stores the private Cloudinary credentials. The mobile app never receives those credentials.**

---

### Netlify responsibilities

The backend is responsible for tasks such as:

1. authenticating server-side requests to Cloudinary using environment variables;
2. reading resources from the Audio Beat Cloudinary song folder;
3. converting raw Cloudinary resources/context metadata into clean application JSON;
4. exposing catalogue/search/album endpoints to the mobile client;
5. optionally caching catalogue results to reduce repeated Cloudinary administrative API calls;
6. returning secure media-delivery URLs that the app can stream directly.

The app-facing catalogue service uses endpoints such as:

```text
GET /api/songs
GET /api/search?q=<query>
GET /api/albums
```

A simplified request looks like:

```text
Audio Beat
    ↓
GET /api/songs
    ↓
Netlify
    ↓
Cloudinary catalogue lookup
    ↓
Normalized JSON
    ↓
Audio Beat PlayerContext
```

---

### Why the media does not stream through Netlify

**Netlify primarily supplies catalogue metadata and safe delivery URLs.**

After the backend returns a Cloudinary delivery URL, the Android Media3 player can stream the media directly from Cloudinary:

```text
1. App requests catalogue from Netlify
2. Netlify reads Cloudinary metadata
3. Netlify returns song JSON + secure delivery URL
4. Media3 requests the media from Cloudinary
```

Therefore large audio files do not need to be proxied through the Netlify function for normal playback.

This reduces:

- backend bandwidth;
- serverless execution time;
- unnecessary latency.

---

### Backend security model

Private backend values should be configured in Netlify environment variables, for example:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_SONG_FOLDER=audio-beat/songs
```

The repository should contain only the variable names or placeholders — never their production values.

The frontend may contain or receive public delivery URLs because those URLs are required for playback. A delivery URL is not equivalent to a Cloudinary administrative API secret.

---

### Uploading is intentionally separate from the public app API

**The normal mobile application does not expose a public `upload song` API endpoint.**

Song administration is performed through:

```text
ingest-song.mjs
```

on a trusted development/admin machine.

This separation is intentional:

```text
Trusted developer machine
        ↓
ingest-song.mjs
        ↓
Local .env credentials
        ↓
Cloudinary upload
```

while ordinary app users follow:

```text
Audio Beat
    ↓
Netlify read/catalogue API
    ↓
Cloudinary
```

This prevents a public mobile client from receiving upload/admin credentials.

---

## External Service Architecture

Audio Beat uses different external services for clearly separated responsibilities.

| **Service** | **Purpose** | **Credential exposure** |
| :--- | :--- | :--- |
| Cloudinary | Stores cloud songs, album artwork and optional videos; provides delivery URLs | Admin credentials remain server-side/local-admin only |
| Netlify | Hosts the backend catalogue/API boundary | Private variables stored in Netlify environment |
| LRCLIB | Provides synchronized/plain lyrics | Called only for lyric retrieval |
| TheAudioDB | Provides artist imagery | Used by the artist-image service |
| Android Media3 | Native playback/session/cache layer | No external API credential |
| Capacitor | Bridge between React/TypeScript and Android/Kotlin | No external API credential |

---

## Data and Persistence Overview

Audio Beat stores different information in the appropriate layer.

| **Data** | **Storage / location** |
| :--- | :--- |
| Cloud music files | Cloudinary |
| Cloud album artwork | Cloudinary + local artwork cache |
| Optional cloud song videos | Cloudinary + local video storage when downloaded |
| Cloud catalogue metadata | Netlify response + client-side cached catalogue |
| Cloud audio playback cache | Android Media3 persistent cache |
| Recently Played | Local application storage |
| Play counts / Most Played | Local application storage |
| Liked songs | Local application storage |
| Playlists | Local application storage |
| Top Artists history | Local application storage |
| Cached Top Artist images | Local browser/WebView cache |
| Android Auto browse library snapshot | Native Android persistent storage |
| User profile name/settings | Local application storage |

No private Cloudinary administration secret is required in `PlayerContext`, the React UI, or the APK's frontend bundle.


---


## Architecture at a Glance

```text
                    ┌────────────────────────────────────┐
                    │            Audio Beat              │
                    │      React + TypeScript UI         │
                    └──────────────────┬─────────────────┘
                                       │
                               Capacitor bridge
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
                 ▼                                           ▼
       Native Android layer                          Cloud services
     Kotlin + Media3/ExoPlayer                    Netlify + Cloudinary
                 │                                           │
                 ├─ Local media scan                          ├─ Catalogue API
                 ├─ Background playback                      ├─ Search / albums
                 ├─ Audio-output detection                   └─ Media delivery URLs
                 ├─ Offline audio cache
                 └─ Android Auto
```

## How Audio Beat Works

**Audio Beat supports two music sources:**

1. songs stored locally on the Android device;
2. songs stored in the application's Cloudinary catalogue.

Both are converted into the same application song model and exposed through `PlayerContext`.

### Application flow

```text
                    ┌───────────────────────────┐
                    │       Audio Beat App      │
                    └─────────────┬─────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
                   ▼                             ▼
          Local Android music            Cloud music catalogue
                   │                             │
          MusicScanner plugin                    │
                   │                      Netlify API
                   │                             │
                   │                       Cloudinary
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                          PlayerContext
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
             ▼                    ▼                    ▼
        React UI             Media3 player       App features
                                                   │
                                   ┌───────────────┼───────────────┐
                                   │               │               │
                                   ▼               ▼               ▼
                                Lyrics        Android Auto     Music Trivia
```

### Startup flow

**When the app starts:**

1. the React application initializes the player and profile providers;
2. local Android songs are discovered through the native music scanner;
3. the Cloudinary catalogue is requested through the backend API;
4. local and cloud songs are converted into the application's shared `Song` format;
5. `PlayerContext` exposes songs, queue, playback state, playlists, liked songs, recently played history and play statistics;
6. persisted application state is restored;
7. cached catalogue/artwork can be used when the network is unavailable;
8. Android Auto library data is synchronized to native storage.

---

## Playback Flow

**When a song is selected:**

```text
User selects song
      ↓
PlayerContext
      ↓
Native AudioPlayer Capacitor plugin
      ↓
Android Media3 / ExoPlayer
      ↓
MediaSession
      ↓
Playback + notification + lock-screen controls + Android Auto
```

For Cloudinary songs, the HTTPS media URL is sent to Media3.

For local songs, the Android `content://` URI is used directly.

The active queue is also passed to the native player so Next and Previous remain consistent with the section or playlist the user selected.

---

## Offline Behaviour and Caching

**Audio Beat uses multiple persistence layers.**

### Cloud catalogue

The latest available cloud catalogue is stored locally so the app can restore known cloud songs when the backend is unavailable.

### Album artwork

Cloud album artwork is cached locally and can be restored offline.

### Cloud audio

Cloudinary audio played through Media3 is stored in the application's persistent audio cache. Already-cached media can continue to be used offline.

### Top Artists

Top Artists history is persisted locally and previously fetched artist artwork is cached so it can be restored during offline startup.

### Video backgrounds

Downloaded song videos are stored locally and reused when the same linked video is needed again.

---

## Cloud Music Ingestion

**Songs are added to the cloud catalogue using the project's Node.js ingestion script:**

```text
ingest-song.mjs
```

**Run this file whenever a new song needs to be added to the Audio Beat Cloudinary catalogue.**

> **Security:** Do not put Cloudinary credentials directly inside the script. The uploader reads them from environment variables.

### Ingestion script requirements

The uploader uses:

- `cloudinary`
- `music-metadata`
- `dotenv`

If these packages are not already installed in the folder containing the script:

```bash
npm install cloudinary music-metadata dotenv
```

### Required environment variables

Create a local `.env` file beside the ingestion script:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_SONG_FOLDER=audio-beat/songs
```

**Never commit this `.env` file to GitHub.**

---

### Uploading a Song to Cloudinary

### Option 1 — run the script and enter the path when prompted

```bash
node ingest-song.mjs
```

The script asks:

```text
Enter song path:
```

Example:

```text
C:\Music\My Song.mp3
```

### Option 2 — provide the audio path directly

```bash
node ingest-song.mjs "C:\Music\My Song.mp3"
```

The script then reads the file's audio metadata automatically.

---

### Metadata Extracted During Ingestion

Using `music-metadata`, the uploader reads available information such as:

- title
- artist
- album
- genre
- release year
- track number
- track total
- disc number
- disc total
- duration
- embedded artwork

This information is stored with the Cloudinary audio resource so the backend can build the application's catalogue.

---

### Album-Art Flow During Upload

If the audio contains embedded artwork, the uploader asks:

```text
Album art option:

1. Upload embedded MP3 artwork
2. Reuse existing Cloudinary image URL
3. No album art
```

### Choice 1 — upload embedded artwork

The embedded image is extracted and uploaded to:

```text
audio-beat/artwork
```

### Choice 2 — reuse existing artwork

Paste a secure Cloudinary image URL containing:

```text
https://res.cloudinary.com/
```

and:

```text
/image/upload/
```

This is useful when multiple songs use the same album artwork.

### Choice 3 — no artwork

No album-art URL is attached to the song.

### When no embedded artwork exists

The uploader asks:

```text
Enter existing Cloudinary album art URL (leave blank for no album art):
```

Paste an existing Cloudinary image URL or press Enter to continue without artwork.

---

### Optional Song Video

The uploader also asks:

```text
Enter video path / existing Cloudinary video URL (leave blank for no video):
```

### Upload a new video

Enter a local path such as:

```text
C:\Videos\My Song.mp4
```

The video is uploaded to:

```text
audio-beat/videos
```

### Reuse an existing Cloudinary video

Paste an existing Cloudinary video URL containing:

```text
https://res.cloudinary.com/
```

and:

```text
/video/upload/
```

This allows multiple songs to reuse the same Cloudinary video instead of uploading duplicates.

### No video

Press Enter without entering anything.

---

### Complete Song Upload Flow

```text
Run ingest-song.mjs
        ↓
Enter/select audio file
        ↓
Read audio metadata
        ↓
Detect embedded album artwork
        ↓
Upload artwork / reuse artwork / no artwork
        ↓
Enter local video path / existing video URL / no video
        ↓
Build Cloudinary context metadata
        ↓
Upload audio
        ↓
Store song in Cloudinary
        ↓
Backend catalogue reads the resource
        ↓
Audio Beat receives it through the API
```

Audio resources are stored by default in:

```text
audio-beat/songs
```

Cloudinary handles audio uploads as `video` resource types.

The uploader stores useful catalogue metadata including title, artist, album, duration, genre, year, track/disc data, artwork URL and optional video URL.

After a successful upload, the terminal reports information such as:

```text
Song uploaded successfully

Title
Artist
Album
Duration
Asset ID
Public ID
Folder
Artwork
Video
Stream URL
```

---

### How Cloud Songs Reach the App

**Uploading a song does not require editing the React app.**

```text
Cloudinary
    ↓
Netlify backend catalogue
    ↓
CloudMusicService
    ↓
PlayerContext
    ↓
Home / Search / Albums / Library / Music Trivia
```

The backend reads supported audio assets from the Cloudinary song folder and normalizes their metadata for the app.

Supported cloud audio formats include:

- MP3
- M4A
- AAC
- WAV
- FLAC
- OGG

The backend catalogue may cache its response briefly, so a newly uploaded song may not appear immediately.

---

## Local Music

Local Android songs follow this flow:

```text
Android media storage
      ↓
MusicScannerPlugin
      ↓
PlayerContext
      ↓
React UI
      ↓
AudioPlayerPlugin
      ↓
Media3
```

**Local songs do not need to be uploaded to Cloudinary.**

---

## Lyrics

**Audio Beat uses LRCLIB for lyrics.**

When lyrics are requested, the application uses the current song metadata to search for:

- synchronized timestamped lyrics;
- plain lyrics when synchronized lyrics are unavailable.

---

## Artist Images

**Top Artist images are obtained through TheAudioDB.**

Successful artist images are cached so previously loaded Top Artist artwork can still be restored when the app starts offline.

---

## Music Trivia

Music Trivia generates questions from the Cloudinary catalogue.

The game contains:

- 5 rounds
- 7 questions per round
- 3 lives for the full game
- progressively shorter timers

| **Round** | **Time per question** |
| :--- | ---: |
| 1 | 30 seconds |
| 2 | 25 seconds |
| 3 | 20 seconds |
| 4 | 15 seconds |
| 5 | 10 seconds |

A wrong answer costs one life.

If the timer reaches zero without an answer, one life is lost and the game proceeds to the next question.

When all three lives are lost, the game ends.

Completing all five rounds declares the player the winner.

Trivia uses Cloudinary song metadata such as title, artist, album, release year, album artwork and audio URL.

For audio-recognition questions, the excerpt is always played from the exact underlying song associated with that question.

---

## Android Auto

> **Supported:** Audio Beat includes **Android Auto media integration** for browsing and controlling music from a compatible vehicle/head unit.

**Audio Beat exposes its library through the native Android Media3 library/session layer.** Android Auto uses the app's media-library/session integration to present a **driver-optimized native car interface** rather than mirroring the React phone UI.

The browse structure is:

```text
Audio Beat
├── Recently Played
├── Liked Songs
├── Playlists
│   └── <playlist name>
└── All Songs
```

Selecting a song installs the appropriate queue so **Next** and **Previous** remain inside the selected category or playlist.

Android Auto support covers the **music/media experience**. Lyrics and decorative song-video backgrounds remain phone-app features and are not part of the Android Auto browsing interface.

According to the official Android documentation, Android Auto provides a driver-optimized experience by connecting a compatible Android phone app to a supported vehicle or aftermarket head unit.

---

## Installation

### Requirements

For web development:

- Node.js
- npm

For Android development:

- Android Studio
- Android SDK
- a Java/JDK version compatible with the Android project
- Capacitor project dependencies

Clone the repository:

```bash
git clone <your-repository-url>
cd audio-beat
```

Install dependencies:

```bash
npm install
```

---

## Running the Web App

Start the Vite development server:

```bash
npm run dev
```

---

## Building the Web App

Create the production build:

```bash
npm run build
```

---

## Running the Android App

After changing React / TypeScript code:

```bash
npm run build
npx cap sync android
```

Then open Android Studio:

```bash
npx cap open android
```

Typical development cycle:

```text
Edit React / TypeScript
        ↓
npm run build
        ↓
npx cap sync android
        ↓
Build / Run from Android Studio
```

---

## Important Project Directories

```text
audio-beat/
├── android/
│   └── app/
│       └── src/main/
│           └── java/com/audio/beat/app/
│
├── src/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── plugins/
│   ├── services/
│   ├── types/
│   └── utils/
│
├── ingest-song.mjs
├── package.json
├── package-lock.json
├── capacitor.config.*
├── vite.config.*
└── README.md
```

---

## Main Application Areas

## `src/components`

Reusable UI and full-screen components such as Now Playing, Settings, Profile and Music Trivia.

## `src/context`

Shared application state.

`PlayerContext` coordinates the song catalogue, current song, playback state, queue, recently played songs, play counts, playlists, liked songs and native playback integration.

## `src/pages`

Main screens such as:

- Home
- Search
- Albums
- Library
- Local Files

## `src/services`

Services for tasks such as:

- cloud catalogue access
- lyrics
- artist images
- music scanning

## `src/plugins`

TypeScript bridges to native Capacitor plugins.

## `android`

Native Android code including Media3 playback, local media integration, audio-output handling and Android Auto support.

---

## Environment Variables and Repository Security

**This project uses environment variables for private credentials and deployment-specific configuration.**

### Never commit

Do not publish:

- `.env`
- Cloudinary API secrets
- private API keys
- access tokens
- signing passwords
- Android keystores
- `key.properties`
- `keystore.properties`
- private keys

Recommended `.gitignore` entries:

```gitignore
node_modules/
dist/

.env
.env.*
!.env.example

android/.gradle/
android/build/
android/app/build/
android/local.properties

*.jks
*.keystore
key.properties
keystore.properties

*.apk
*.aab
```

### Safe `.env.example`

A public example file may contain placeholder values:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_SONG_FOLDER=audio-beat/songs
```

Never place real credentials in `.env.example`.

---

## API URLs vs API Secrets

**A frontend or mobile application cannot truly hide an endpoint that it calls at runtime.**

A public backend URL is normally configuration, not a secret.

Credentials that authorize privileged Cloudinary operations are different and must remain private.

The intended architecture is:

```text
React / Android app
        ↓
Public backend endpoint
        ↓
Backend environment variables
        ↓
Cloudinary administration API
```

Cloudinary administrative credentials should remain in the backend or local ingestion environment and must never be bundled into the React app.

---

## Before Publishing to GitHub

Search the repository for sensitive values.

PowerShell:

```powershell
Get-ChildItem -Recurse -File |
Select-String -Pattern "api[_-]?key|secret|password|token|authorization|bearer|private[_-]?key|client[_-]?secret"
```

Also verify that no generator/template references remain:

```powershell
Get-ChildItem -Recurse -File |
Select-String -Pattern "magicpatterns|Magic Patterns|magic-patterns"
```

Review every result manually.

Then check what Git will commit:

```bash
git status
```

Confirm that `.env`, signing files, keystores, credentials and generated build output are not staged.

---

## GitHub Setup

Initialize the repository:

```bash
git init
```

Add files:

```bash
git add .
```

Review:

```bash
git status
```

Create the initial commit:

```bash
git commit -m "Initial Audio Beat project"
```

Add the GitHub remote:

```bash
git remote add origin <your-github-repository-url>
```

Push:

```bash
git branch -M main
git push -u origin main
```

---

## Portfolio Suggestions

Useful screenshots for this README include:

- Home
- Now Playing
- Synced Lyrics
- Albums
- Library / playlists
- Local Files
- Android Auto
- Music Trivia
- Settings

A short screen recording or GIF showing playback, lyrics, car integration and Music Trivia can also help visitors understand the project quickly.

---


## References and Official Documentation

The following official resources were used as technical references while developing, integrating, testing, and documenting Audio Beat.

| **Technology / Service** | **Role in Audio Beat** | **Official reference** |
| :--- | :--- | :--- |
| **ChatGPT by OpenAI** | Development assistance, debugging support, architecture discussion and documentation assistance | [ChatGPT](https://chatgpt.com/) |
| **Android Developers** | Android platform APIs, permissions, services and native application development | [Android Developers](https://developer.android.com/) |
| **Jetpack Media3** | Native audio playback, ExoPlayer, media sessions, media controllers and library browsing | [Jetpack Media3](https://developer.android.com/media/media3) |
| **Android Auto** | Driver-optimized media browsing and playback integration | [Android Auto media-app documentation](https://developer.android.com/training/cars/media/auto) |
| **Android for Cars** | Media-app architecture and car-platform integration guidance | [Android for Cars — Media](https://developer.android.com/media/implement/surfaces/cars) |
| **Cloudinary** | Cloud storage and delivery for songs, album artwork and optional videos | [Cloudinary Documentation](https://cloudinary.com/documentation/) |
| **Cloudinary Upload API** | Media upload and asset-management reference used by the ingestion workflow | [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference) |
| **Netlify Functions** | Backend/API layer between the mobile client and Cloudinary administration APIs | [Netlify Functions](https://docs.netlify.com/build/functions/overview/) |
| **Netlify Environment Variables** | Server-side storage of API credentials and deployment configuration | [Netlify environment variables](https://docs.netlify.com/build/functions/environment-variables/) |
| **LRCLIB** | Synced and plain lyric retrieval | [LRCLIB API Documentation](https://lrclib.net/docs) |
| **TheAudioDB** | Artist-image lookup for the Top Artists experience | [TheAudioDB Music API](https://www.theaudiodb.com/free_music_api) |
| **Capacitor** | Bridge between the React/TypeScript application and native Android/Kotlin functionality | [Capacitor Documentation](https://capacitorjs.com/docs) |
| **React** | Frontend component architecture and application UI | [React Documentation](https://react.dev/) |
| **TypeScript** | Typed frontend/application development | [TypeScript Documentation](https://www.typescriptlang.org/docs/) |
| **Vite** | Frontend development server and production build tooling | [Vite Documentation](https://vite.dev/guide/) |

### Android Auto reference

Audio Beat's Android Auto implementation follows the Android media-app model where a media application exposes its content through a media browser/library service and a media session.

Official Android resources:

- **Android Auto overview:** [developer.android.com/training/cars/platforms/android-auto](https://developer.android.com/training/cars/platforms/android-auto)
- **Add Android Auto support to a media app:** [developer.android.com/training/cars/media/auto](https://developer.android.com/training/cars/media/auto)
- **Media apps for cars:** [developer.android.com/training/cars/media](https://developer.android.com/training/cars/media)
- **Media3 session/controller architecture:** [developer.android.com/media/media3/session/connect-to-media-app](https://developer.android.com/media/media3/session/connect-to-media-app)

### API and cloud references

- **LRCLIB API:** [https://lrclib.net/docs](https://lrclib.net/docs)
- **Cloudinary developer documentation:** [https://cloudinary.com/documentation/](https://cloudinary.com/documentation/)
- **Cloudinary Upload API:** [https://cloudinary.com/documentation/image_upload_api_reference](https://cloudinary.com/documentation/image_upload_api_reference)
- **TheAudioDB API:** [https://www.theaudiodb.com/free_music_api](https://www.theaudiodb.com/free_music_api)
- **Netlify Functions:** [https://docs.netlify.com/build/functions/overview/](https://docs.netlify.com/build/functions/overview/)
- **Netlify environment variables:** [https://docs.netlify.com/build/functions/environment-variables/](https://docs.netlify.com/build/functions/environment-variables/)

### Development-assistance reference

**ChatGPT by OpenAI** was used as a development-assistance tool during parts of the project's iterative design, debugging, code review and documentation process.

- **ChatGPT:** [https://chatgpt.com/](https://chatgpt.com/)
- **OpenAI:** [https://openai.com/](https://openai.com/)

The application itself does **not** depend on ChatGPT or the OpenAI API at runtime unless such an integration is explicitly added in the future.

---

## Project Status

Audio Beat is under active development.

---

## Disclaimer

Music files, album artwork, artist imagery, lyrics and other third-party media are subject to their respective owners' rights and service terms.

This repository is intended to demonstrate the application's architecture and source code. Private credentials and production secrets are intentionally excluded.

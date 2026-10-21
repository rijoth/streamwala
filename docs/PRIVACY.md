# Streamwala privacy policy

Last updated: 21 October 2026

Streamwala is a client-side IPTV player published by Rijo Thomas, an individual
developer. This policy covers the Streamwala app for Android tablets
(`tv.streamwala.iptv`), the Streamwala TV app for Android TV and Google TV
(`tv.streamwala.iptv.tv`), and the Streamwala web app.

The short version: **the app has no account system, no developer server and no
telemetry. What you add to it stays on your device.**

## What the app stores on your device

Everything the app knows lives in local storage on your device:

- the playlists you add, including M3U/M3U8 URLs, local files and Xtream Codes
  server addresses, usernames and passwords
- the channels, groups and guide data downloaded from those sources
- your favourites, guide mappings and playback history
- app settings such as theme, UI scale, playback engine and any proxy template
  you configure

Channels, guide data and playlists are kept in the app's IndexedDB database
(Dexie); small settings are kept in `localStorage`. The developer never receives
any of it. There is no backup to a developer service, no sync and no cloud
account.

## What the app does not collect

The app contains no analytics, no advertising SDK, no crash reporting, no
device-identifier collection, no fingerprinting and no third-party tracking. It
does not ask for your name, email address, phone number or location, and it has
no sign-up or login.

## Network connections

The app only contacts servers **you** configure:

- the playlist, Xtream Codes and XMLTV/EPG hosts you add, to fetch channel lists,
  guide data and media
- the stream hosts referenced by your playlist, to play video
- a CORS proxy, only if you configure one in Settings and only as a fallback for
  requests the origin refuses

Those connections are ordinary HTTP requests, so the operator of each server can
see your IP address, the request path and the credentials in the URL you
configured, exactly as a browser would send them. That is how IPTV endpoints
work; the app does not add anything to the request. If you configure a proxy,
that proxy sees the URLs it relays — choose one you trust, or leave the field
empty.

The developer operates no server in this path and therefore does not see, log or
store any of these requests.

## Android permissions

The Android builds request three permissions, all used only for the functions
described above:

| Permission | Why |
| --- | --- |
| `INTERNET` | fetch playlists, guide data and video from your sources |
| `ACCESS_NETWORK_STATE` | distinguish "offline" from "this host is unreachable" when diagnosing a failed import |
| `WAKE_LOCK` | keep the screen and CPU awake during playback |

No storage, contacts, location, camera, microphone or notification permission is
requested. The app reads a local playlist only when you pick a file in the
Android file picker.

## Security and your device

The local database is protected by Android's app sandbox: other apps cannot read
it, and it is removed when you uninstall the app. It is not separately encrypted
by the app, so playlist credentials receive the same protection as the rest of
your device storage — keep device encryption and a screen lock enabled.

Many IPTV providers still serve plain `http://` endpoints, so the Android shell
permits cleartext HTTP traffic for the sources you add. That traffic is not
encrypted in transit and can be read on the network path between your device and
the provider. Use HTTPS sources where the provider offers them.

## Your control over the data

- Remove a playlist, and its channels, guide data and mappings are deleted from
  the device.
- "Clear app data" in Android settings, or clearing site data for the web app,
  removes everything.
- Uninstalling the app removes everything.

There is nothing to request from the developer, because the developer holds no
copy of your data.

## Sharing, selling and legal requests

The developer does not sell, rent or share app data, because none is collected.
There is no data to disclose in response to a request, and no advertising or
analytics partner to disclose it to.

## Children

The app is a media player for content you provide. It is not directed at
children, and it does not knowingly collect any personal information from anyone.

## Third-party services and content

Streamwala ships no channels, playlists or guide data. Sources you add, and any
proxy you configure, are operated by third parties under their own privacy
policies. The demo list that ships with the app points only at public test
streams and open movie clips.

## Changes to this policy

If the app's data handling changes — for example if an optional feature ever
sends data off the device — this page is updated before that version ships, and
the date at the top changes with it. Because the app has no telemetry, a material
change is also called out in the release notes.

## Contact

Questions about this policy: **rijothomas64@gmail.com**

The app's source code is public at
<https://github.com/rijoth/streamwala>, so the claims above can be checked
against the code rather than taken on trust.

# YouTube Memory Lane

Look back at your old YouTube life: the comments you wrote, live chats, messages, videos you uploaded, and everything you watched, sorted by "1 year ago", "5 years ago", "on this day", and more.

Everything runs on your own computer. Your data is never uploaded anywhere.

## 1. Get your data from Google

1. Go to [takeout.google.com](https://takeout.google.com).
2. Click **Deselect all**, then tick **YouTube and YouTube Music**.
3. Click **All YouTube data included** and keep only:
   - **comments**
   - **history**
   - **live chats**
   - **messages** (optional)
   - **video metadata** (optional, gives titles for videos you uploaded)

   Leave **videos** unticked. Your uploaded videos can be tens of gigabytes, and this app doesn't need them.
4. Optional: under **Multiple formats**, set history to **JSON** (it loads faster than HTML).
5. Click **Next step**, choose **Export once** and **.zip**, then **Create export**.
6. Google emails you when the export is ready, usually within minutes to a few hours. Download it.

## 2. Open the app

**Easiest (auto-loads every time):** needs [Node.js](https://nodejs.org) installed.

1. Unzip your Takeout download.
2. Copy the CSV/HTML/JSON files into the `my-data` folder (subfolders are fine).
3. Double-click `start.bat` (Windows), or run `node server.js`. The app opens in your browser.

**No install:** double-click `index.html`, then drop your Takeout `.zip` or unzipped folder onto the page. The app remembers it for next time.

## What it can show

| Takeout file | Shows up as |
| --- | --- |
| `comments/*.csv` (or older `my-comments.html`) | Comments and replies |
| `live chats/*.csv` | Live chats |
| `messages/conversation_*.csv` | Messages and shared videos |
| `video metadata/video texts.csv` | My uploads |
| `history/watch-history.html` or `.json` | Watch history |

Video titles that aren't in your export are looked up from YouTube as you scroll. You can turn this off in the app.

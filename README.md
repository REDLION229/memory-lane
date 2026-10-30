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

1. Download this project (green **Code** button, then **Download ZIP**) and unzip it.
2. Double-click `index.html`. It opens in your browser.
3. Click **Import your YouTube data** and select every Takeout `.zip` at once. You don't need to unzip them.

Your data is saved in your browser, so it's there the next time you open the app. Use **Add files** to add more later, or **Start over** to erase it.

**Optional, auto-load from a folder:** if you have [Node.js](https://nodejs.org), put your unzipped Takeout files in the `my-data` folder and run `start.bat` (Windows) or `node server.js`. The app loads everything in that folder each time it opens.

## What it can show

| Takeout file | Shows up as |
| --- | --- |
| `comments/*.csv` (or older `my-comments.html`) | Comments and replies |
| `live chats/*.csv` | Live chats |
| `messages/conversation_*.csv` | Messages and shared videos |
| `video metadata/video texts.csv` | My uploads |
| `history/watch-history.html` or `.json` | Watch history |

Video titles that aren't in your export are looked up from YouTube as you scroll. You can turn this off in the app.

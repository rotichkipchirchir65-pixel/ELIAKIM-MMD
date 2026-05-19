# ELIAKIM MD — WhatsApp Bot

A professional, high-performance WhatsApp bot with 24/7 GitHub Actions support.

## 🚀 Deployment (Real Setup)

1. **Export Code**: Export this project to your GitHub repository.
2. **Configuration**: 
   - Open `config.js` in the root directory.
   - Enter your **OWNER_NUMBER** (international format).
   - Enter your **SESSION_ID** (The encrypted string provided by the bot helper).
   - Set your desired **BOT_NAME** and **PREFIX**.
3. **Turn on Actions**: 
   - Go to the **Actions** tab in your GitHub repo.
   - Enable workflows if they are disabled.
   - The bot will start automatically. It is configured to run on every push and has a keep-alive schedule every 6 hours.

## 🛠 Commands
- `.ping` - Check latency
- `.menu` - Show command list
- `.owner` - Get owner vcard
- `.yt` - YouTube downloader (Coming soon)
- `.typing` - Enable always-typing mode

## ⚙️ Core Logic
Everything is managed via `config.js`. No external secrets or environment variables are required for the bot to function, making it easy to fork and run.

_Built with ❤️ by ELIAKIM MD_

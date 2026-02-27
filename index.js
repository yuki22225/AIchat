// .envの読み込み
require('dotenv').config();
//console.log("APIキー確認:", process.env.GEMINI_API_KEY); // APIの読込を確認

const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Client } = require("@notionhq/client"); //notionSDKの読み込み

//サーバー
const app = express();
const PORT = 3000;

//文字コード
//app.use(express.json({ type: "application/json; charset=utf-8" }));

// APIキーの認証
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//geminiAPIのバージョンを確認、アシスタントの性格
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: "あなたは九州の方言で話すAIアシスタントです。かわいらしい言葉遣いで話してください。"
});
//NotionAPI→データベースとしての役割
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const pageId = process.env.NOTION_PAGE_ID;

// 2000文字ごとに分割する関数
function splitText(text, maxLength = 2000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

//リクエストデータをjson形式で読めるように
app.use(express.json());
//静的ファイルの配信設定
app.use(express.static("public"));

// 会話履歴をサーバー側で保持
let chatHistory = [];

//app.get("/", (req, res) => {
 // res.send("AI Chat Bot is running");
//});

//app.post:POSTリクエスト時の処理
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

//try~catch:エラー時はcatchへ移行
  try {
    const chat = model.startChat({ history: chatHistory }); //会話履歴の作成
    const result = await chat.sendMessage(userMessage);
    const text = result.response?.text() || "返答なし";

    // 履歴に追加
    chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
    chatHistory.push({ role: "model", parts: [{ text: text }] });

    //notionへの保存設定
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      ...splitText(`ユーザー: ${userMessage}`).map(chunk => ({
        paragraph: { rich_text: [{ text: { content: chunk } }] }
      })),
      ...splitText(`AI: ${text}`).map(chunk => ({
        paragraph: { rich_text: [{ text: { content: chunk } }] }
      }))
    ]
});

    res.json({ reply: text });
  } catch (error) {
    console.error("AI呼び出しエラー:", error); // ターミナルに詳細表示(console)
    res.status(500).json({ error: "AIエラー" });
  }
});


// 履歴をリセットするエンドポイント
app.post("/reset", (req, res) => {
  chatHistory = [];
  res.json({ message: "履歴をリセットしました" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
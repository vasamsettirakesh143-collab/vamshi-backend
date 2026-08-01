import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Vamshi backend is running");
});

app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are Vamshi, a helpful personal AI assistant created by Rakesh."
        },
        {
          role: "user",
          content: message
        }
      ],

      model: "llama-3.1-8b-instant"

    });

    const reply = response.choices[0].message.content;

    res.json({
      reply: reply
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      reply: "Sorry, my brain is temporarily unavailable."
    });

  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
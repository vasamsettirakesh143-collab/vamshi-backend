import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

console.log("API key exists:", !!process.env.OPENAI_API_KEY);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: message
    });

    res.json({
      reply: response.output_text
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
  console.log("Vamshi Backend Running on Port " + PORT);
});
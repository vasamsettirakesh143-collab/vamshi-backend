import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Temporary chat memory

let chatHistory = [
    {
        role: "system",
        content: "You are Vamshi, a helpful AI assistant created by Rakesh."
    }
];

app.get("/", (req, res) => {
    res.send("Vamshi backend is running");
});

app.post("/chat", async (req, res) => {

    try {

        const message = req.body.message;

        chatHistory.push({
            role: "user",
            content: message
        });

        // Keep only the last 20 messages

        if (chatHistory.length > 21) {

            chatHistory = [
                chatHistory[0],
                ...chatHistory.slice(-20)
            ];

        }

        const response = await groq.chat.completions.create({

            model: "openai/gpt-oss-20b",

            messages: chatHistory

        });

        const reply = response.choices[0].message.content;

        chatHistory.push({

            role: "assistant",

            content: reply

        });

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

import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

app.post('/identify', (req: Request, res: Response) => {
  res.status(200).json({
    contact: {
      primaryContactId: 1,
      emails: ["test@example.com"],
      phoneNumbers: ["123456"],
      secondaryContactIds: []
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

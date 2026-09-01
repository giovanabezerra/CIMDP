const express = require("express");
const app = express();

// A Render define automaticamente a porta certa nessa variável.
// Em testes no seu computador, ela usa 3000 como padrão.
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("CIMDP back-end está no ar! 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

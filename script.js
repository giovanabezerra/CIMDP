const formulario = document.querySelector("#form-login");

const email = document.querySelector("#email");

const senha = document.querySelector("#senha");

const mensagem = document.querySelector("#mensagem-login");

formulario.addEventListener("submit", function (evento) {

```
evento.preventDefault();

// Verifica se os campos estão preenchidos
if (email.value.trim() === "" || senha.value.trim() === "") {

    mensagem.textContent = "Preencha o e-mail e a senha.";
    mensagem.className = "erro";

    return;
}


// Verifica se o e-mail possui @
if (!email.value.includes("@")) {

    mensagem.textContent = "Digite um e-mail válido.";
    mensagem.className = "erro";

    return;
}


// Login validado
mensagem.textContent = "Login validado com sucesso.";
mensagem.className = "sucesso";
```

});

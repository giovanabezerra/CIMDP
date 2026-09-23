const formulario = document.querySelector("#form-funcionario");

const nome = document.querySelector("#nome");

const email = document.querySelector("#email");

const cargo = document.querySelector("#cargo");

const senha = document.querySelector("#senha");

const confirmarSenha =
    document.querySelector("#confirmar-senha");

const mensagem =
    document.querySelector("#mensagem-cadastro");


formulario.addEventListener("submit", function (evento) {

    evento.preventDefault();


    // VERIFICA SE TODOS OS CAMPOS FORAM PREENCHIDOS

    if (
        nome.value.trim() === "" ||
        email.value.trim() === "" ||
        cargo.value === "" ||
        senha.value.trim() === "" ||
        confirmarSenha.value.trim() === ""
    ) {

        mensagem.textContent =
            "Preencha todos os campos.";

        mensagem.className = "erro";

        return;
    }


    // VERIFICA O E-MAIL

    if (!email.value.includes("@")) {

        mensagem.textContent =
            "Digite um e-mail válido.";

        mensagem.className = "erro";

        return;
    }


    // VERIFICA O TAMANHO DA SENHA

    if (senha.value.length < 6) {

        mensagem.textContent =
            "A senha deve possuir pelo menos 6 caracteres.";

        mensagem.className = "erro";

        return;
    }


    // VERIFICA SE AS SENHAS SÃO IGUAIS

    if (senha.value !== confirmarSenha.value) {

        mensagem.textContent =
            "As senhas não coincidem.";

        mensagem.className = "erro";

        return;
    }


    // CADASTRO VALIDADO

    mensagem.textContent =
        "Funcionário cadastrado com sucesso!";

    mensagem.className = "sucesso";


    // LIMPA O FORMULÁRIO

    formulario.reset();

});
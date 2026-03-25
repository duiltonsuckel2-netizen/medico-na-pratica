# ⚡ Médico na Prática

App de estudo para o curso Médico na Prática - Pronto Atendimento.

## Como rodar

### 1. Instalar Node.js
Baixe e instale em: https://nodejs.org (versão LTS)

### 2. Instalar dependências
Abra o terminal na pasta do projeto e rode:
```
npm install
```

### 3. Rodar o app
```
npm run dev
```

Vai aparecer algo como:
```
Local: http://localhost:5173/
```

Abra esse link no navegador.

### 4. Para parar
Aperte `Ctrl + C` no terminal.

## Usando com Claude Code

Para fazer alterações, abra o terminal na pasta do projeto e use o Claude Code:
```
claude
```

Depois é só pedir em português:
- "Muda a cor do módulo 3 para azul"
- "Adiciona um campo de anotações em cada aula"
- "Cria um gráfico de progresso semanal"

## Estrutura

```
medico-na-pratica/
├── index.html          ← Página HTML
├── package.json        ← Dependências
├── vite.config.js      ← Configuração do Vite
└── src/
    ├── main.jsx        ← Ponto de entrada
    ├── index.css       ← Estilos globais
    └── App.jsx         ← Todo o app (componentes, dados, lógica)
```

## Dados salvos

O progresso é salvo no `localStorage` do navegador — funciona mesmo offline, sem servidor. Se limpar os dados do navegador, perde o progresso.

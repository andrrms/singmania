# Karaoke MVP (SingMania!)

Um player de karaokê moderno e web-based, compatível com o formato UltraStar (`.txt`), construído com Nuxt 4, Vue 3 e Tailwind CSS.

## 🎤 Funcionalidades

- **Suporte a UltraStar:** Reproduz arquivos de música e letras no formato padrão `.txt`.
- **Integração com YouTube:** Permite usar vídeos do YouTube como áudio e fundo para as músicas.
- **Modo Dueto:** Suporte visual para músicas com dois cantores (P1/P2).
- **Sincronia Ajustável:** Ferramentas integradas para ajustar o delay (GAP) entre áudio e letra em tempo real.
- **Customização Visual:**
  - Controle de opacidade/blur do fundo.
  - Ajuste de tamanho da fonte da letra.
  - Intro estilo "MTV" com Título e Artista.
- **Controles de Reprodução:** Seek, Play/Pause, Volume e atalhos de teclado.
- **Persistência:** Salva ajustes de sincronia e preferências localmente.

## 🛠️ Tecnologias

- [Nuxt 4](https://nuxt.com/)
- [Vue.js 3](https://vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [VueUse](https://vueuse.org/)
- [Dexie.js](https://dexie.org/) (IndexedDB wrapper)

## 🚀 Como Rodar

### Pré-requisitos

- Node.js (versão 22+ recomendada)
- npm, pnpm ou yarn

### Instalação

Clone o repositório e instale as dependências:

```bash
# npm
npm install
```

### Desenvolvimento

Inicie o servidor de desenvolvimento em `http://localhost:3000`:

```bash
# npm
npm run dev
```

## 🎵 Como Usar

1. Abra a aplicação no navegador.
2. Na tela inicial, você pode carregar arquivos `.txt` do seu computador ou selecionar músicas da biblioteca (se configurada).
3. Para músicas com ID do YouTube configurado no arquivo `.txt` (tag `#VIDEO` ou `#YOUTUBEID`), o player carregará o vídeo automaticamente.
4. Use as configurações (ícone de engrenagem) para ajustar a sincronia se necessário.

## 📦 Build para Produção

Para gerar a versão estática ou de servidor:

```bash
npm run build
```

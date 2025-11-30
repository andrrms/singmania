# Karaoke MVP (SingMania!)

Um player de karaokê moderno e web-based, compatível com o formato UltraStar (`.txt`), construído com Nuxt 4, Vue 3 e Tailwind CSS.

## 🎤 Funcionalidades

- **Sistema de Pontuação e Pitch:** Detecção de tom em tempo real via microfone, com feedback visual (Perfect, Excellent, Good, Ok) e notas douradas.
- **Modos de Jogo:**
  - **Dificuldades:** Fácil, Normal e SingStar! (Expert).
  - **Freestyle:** Cante livremente sem pontuação.
  - **Dueto Completo:** Escolha cantar como Jogador 1, Jogador 2 ou ambos, com filtragem de notas inteligente.
- **Biblioteca Musical:**
  - Gerenciamento local via IndexedDB (salva músicas, capas e estatísticas).
  - Filtros (Duetos, Solo, Já Cantadas) e Ordenação (Rank, Score, Título).
  - Busca instantânea
- **Tela de Resultados:**
  - Rank de desempenho (F a SS).
  - Estatísticas detalhadas com gráficos de barras.
- **Suporte a UltraStar:** Reproduz arquivos de música e letras no formato padrão `.txt`.
- **Integração com YouTube:** Permite usar vídeos do YouTube como áudio e fundo para as músicas.
- **Sincronia Ajustável:** Ferramentas integradas para ajustar o delay (GAP) entre áudio e letra em tempo real.
- **Customização Visual:**
  - Controle de opacidade/blur do fundo.
  - Ajuste de tamanho da fonte da letra.
  - Intro estilo "MTV" com Título e Artista.
- **Controles de Reprodução:** Seek, Play/Pause, Volume e atalhos de teclado.

## 🛠️ Tecnologias

- [Nuxt 4](https://nuxt.com/)
- [Vue.js 3](https://vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [VueUse](https://vueuse.org/)

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
2. Na tela inicial, carregue arquivos `.txt` (e áudio/vídeo opcional) para adicionar à sua **Biblioteca**.
3. Selecione uma música da lista para abrir o player.
4. Escolha a dificuldade e, se for um dueto, qual parte deseja cantar.
5. Permita o acesso ao microfone quando solicitado para habilitar a pontuação.
6. Ao final, confira seu Rank e estatísticas na tela de resultados!
7. Use as configurações (ícone de engrenagem) durante a música para ajustar a sincronia se necessário.

## 📦 Build para Produção

Para gerar a versão estática ou de servidor:

```bash
npm run build
```

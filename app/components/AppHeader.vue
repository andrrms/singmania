<template>
  <header class="w-full p-8 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
        <ClientOnly>
          <Icon name="material-symbols:mic" class="text-white w-6 h-6" />
        </ClientOnly>
      </div>
      <h1 class="text-3xl font-black tracking-tighter uppercase italic">Sing<span class="text-violet-500">Mania!</span>
      </h1>
    </div>
    <nav class="flex gap-4">
      <NuxtLink to="/"
        class="text-white/80 hover:text-white font-bold uppercase text-sm tracking-widest hover:underline decoration-violet-500 underline-offset-4">
        Home
      </NuxtLink>
      <NuxtLink to="/library"
        class="text-white/80 hover:text-white font-bold uppercase text-sm tracking-widest hover:underline decoration-violet-500 underline-offset-4">
        Biblioteca
      </NuxtLink>
      <NuxtLink to="/search"
        class="text-white/80 hover:text-white font-bold uppercase text-sm tracking-widest hover:underline decoration-violet-500 underline-offset-4">
        Pesquisar
      </NuxtLink>
    </nav>
  </header>
</template>

# Floating Glows Animation

Animation de lueurs flottantes utilisée dans le background du menu latéral (`UiMenuOffice`).
Trois orbes colorées (bleu, orange, turquoise) flottent lentement avec des trajectoires différentes, créant un effet de profondeur vivant et subtil.

---

## Structure HTML

```html
<!-- Container parent — doit avoir position: relative et overflow: hidden -->
<div class="glow-container">
  <div class="glow glow--blue"></div>
  <div class="glow glow--orange"></div>
  <div class="glow glow--turquoise"></div>
</div>
```

Le `glow-container` se place en `position: absolute` à l'intérieur d'un parent positionné (`relative`, `fixed`, etc.). Le contenu réel du parent doit avoir un `z-index` supérieur pour rester au-dessus des lueurs.

---

## CSS complet

```css
/* ── Container ── */
.glow-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  border-radius: inherit;
}

/* ── Lueur commune ── */
.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
}

/* ── Lueur bleue ── */
.glow--blue {
  width: 140px;
  height: 140px;
  background: #7096FF;
  top: 5%;
  left: -25%;
  animation: glow-float-blue 12s ease-in-out infinite;
}

/* ── Lueur orange ── */
.glow--orange {
  width: 150px;
  height: 150px;
  background: #FF9072;
  bottom: 10%;
  right: -40%;
  opacity: 0.32;
  animation: glow-float-orange 15s ease-in-out infinite;
}

/* ── Lueur turquoise ── */
.glow--turquoise {
  width: 100px;
  height: 100px;
  background: #65D5C5;
  top: 40%;
  left: 10%;
  opacity: 0.25;
  animation: glow-float-turquoise 18s ease-in-out infinite;
}

/* ── Keyframes ── */

@keyframes glow-float-blue {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.4;
  }
  25% {
    transform: translate(40px, 60px) scale(1.15);
    opacity: 0.5;
  }
  50% {
    transform: translate(15px, 120px) scale(0.9);
    opacity: 0.35;
  }
  75% {
    transform: translate(-25px, 50px) scale(1.05);
    opacity: 0.45;
  }
}

@keyframes glow-float-orange {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.32;
  }
  33% {
    transform: translate(-50px, -80px) scale(1.15);
    opacity: 0.42;
  }
  66% {
    transform: translate(-25px, 40px) scale(0.95);
    opacity: 0.28;
  }
}

@keyframes glow-float-turquoise {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.25;
  }
  20% {
    transform: translate(25px, -40px) scale(1.1);
    opacity: 0.35;
  }
  40% {
    transform: translate(-15px, -80px) scale(0.85);
    opacity: 0.2;
  }
  60% {
    transform: translate(40px, 30px) scale(1.05);
    opacity: 0.3;
  }
  80% {
    transform: translate(-20px, 50px) scale(0.9);
    opacity: 0.25;
  }
}
```

---

## Paramètres clés

| Paramètre | Valeur par défaut | Effet |
|---|---|---|
| `filter: blur()` | `60px` | Taille du flou. Plus c'est élevé, plus les orbes sont diffuses |
| `opacity` | `0.25 – 0.5` | Intensité des lueurs. L'animation fait varier l'opacité |
| `width` / `height` | `100 – 150px` | Taille de chaque orbe |
| Durée animation | `12s / 15s / 18s` | Des durées différentes évitent un cycle répétitif visible |
| `scale()` | `0.85 – 1.15` | Variation de taille pendant le mouvement |
| `translate()` | `±80px` | Amplitude du déplacement |

---

## Couleurs utilisées

| Lueur | Couleur | Hex |
|---|---|---|
| Bleue | Bleu vif | `#7096FF` |
| Orange | Corail / Saumon | `#FF9072` |
| Turquoise | Vert d'eau | `#65D5C5` |

Ces couleurs sont pensées pour un fond sombre type `#2E3862`. Sur un fond clair, augmenter le `blur` et réduire l'`opacity`.

---

## Intégration type (Vue / React / HTML)

### Exemple HTML minimal

```html
<div style="position: relative; background: #2E3862; min-height: 400px; border-radius: 16px; overflow: hidden;">
  <!-- Lueurs -->
  <div class="glow-container">
    <div class="glow glow--blue"></div>
    <div class="glow glow--orange"></div>
    <div class="glow glow--turquoise"></div>
  </div>

  <!-- Contenu (z-index > 0) -->
  <div style="position: relative; z-index: 1; padding: 2rem; color: white;">
    <h2>Mon contenu</h2>
  </div>
</div>
```

### Exemple Vue 3

```vue
<template>
  <div class="my-panel">
    <div class="glow-container">
      <div class="glow glow--blue"></div>
      <div class="glow glow--orange"></div>
      <div class="glow glow--turquoise"></div>
    </div>
    <div class="my-panel__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.my-panel {
  position: relative;
  background: #2E3862;
  border-radius: 16px;
  overflow: hidden;
}

.my-panel__content {
  position: relative;
  z-index: 1;
}

/* Coller ici le CSS des lueurs */
</style>
```

---

## Personnalisation

### Ajouter une 4e lueur

Ajouter un `<div class="glow glow--purple"></div>` et définir :

```css
.glow--purple {
  width: 120px;
  height: 120px;
  background: #A78BFA;
  top: 60%;
  right: 10%;
  opacity: 0.2;
  animation: glow-float-purple 20s ease-in-out infinite;
}

@keyframes glow-float-purple {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
  50% { transform: translate(-30px, -60px) scale(1.1); opacity: 0.35; }
}
```

### Sur fond clair

```css
.glow {
  filter: blur(80px);
  opacity: 0.15;
}
```

### Réduire la consommation GPU

Pour les contextes où la performance compte (mobile, many instances) :

```css
.glow {
  will-change: transform, opacity;
}
```

Ou désactiver complètement avec `prefers-reduced-motion` :

```css
@media (prefers-reduced-motion: reduce) {
  .glow { animation: none; }
}
```

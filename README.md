# Nexus Football 3D

Jogo de futebol 3D mobile para Android, desenvolvido em Godot 4.6.2 estável.

## Estrutura do repositório

- `source_chunks/`: projeto-fonte compactado e armazenado em nove segmentos Base64 verificáveis.
- `.github/workflows/build-football3d.yml`: reconstrói o projeto, confirma seu SHA-256, importa, testa, compila, assina e audita o APK arm64.
- `LICENSE`: licença MIT do código do projeto.

O ZIP reconstruído contém `project.godot` diretamente na raiz. Seu SHA-256 esperado é:

```text
a76d578ba6e45ca46b37c8224bf550a9b2bd1c700d435b89032723a3513b78a9
```

## Conteúdo da versão 0.1.1

- partida 3D 5×5 em dois tempos;
- controles touch e teclado;
- IA de posicionamento, apoio, pressão, finalização, passe e desarme;
- física própria da bola com gravidade, quique, arrasto, rotação e curva;
- gols, laterais e reinícios simplificados;
- câmera broadcast e estádio procedural;
- qualidade gráfica adaptativa por FPS;
- renderer Mobile/Vulkan com fallback OpenGL;
- sete suítes determinísticas e validação estrutural do APK.

## Artefato Android

Cada execução bem-sucedida do workflow publica `NexusFootball3D-Android-arm64-debug`, contendo:

- `NexusFootball3D.apk` instalável;
- hash SHA-256 do APK;
- ZIP integral do projeto-fonte;
- logs de importação, testes, exportação, manifesto e assinatura.

## Escopo real

Esta versão é uma vertical slice jogável e tecnicamente extensível. Não inclui licenças de clubes ou atletas, multiplayer, modo carreira, narração, captura de movimento ou pacote artístico AAA.

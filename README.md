# Nexus Football 3D

Projeto de futebol 3D mobile para Android, desenvolvido em Godot 4.6.2 estável.

## Entregas no repositório

- `NexusFootball3D_Godot462_source_AI_STUDIO_ROOT_OK.zip`: projeto-fonte completo, com `project.godot` diretamente na raiz do ZIP.
- `.github/workflows/build-football3d.yml`: pipeline que importa o projeto, executa testes, compila, assina e verifica o APK arm64.
- `LICENSE`: licença do código do projeto.

## Conteúdo da versão 0.1.1

- partida 3D 5×5 em dois tempos;
- controles touch e teclado;
- IA de posicionamento, apoio, pressão, finalização, passe e desarme;
- física própria da bola com gravidade, quique, arrasto, rotação e curva;
- gols, laterais e reinícios simplificados;
- câmera broadcast e estádio procedural;
- qualidade gráfica adaptativa por FPS;
- renderer Mobile/Vulkan com fallback OpenGL;
- testes determinísticos e validação estrutural do APK.

## APK

Cada execução bem-sucedida do workflow publica o artefato `NexusFootball3D-Android-arm64-debug`, contendo o APK instalável, SHA-256 e logs de validação.

## Escopo

Esta versão é uma vertical slice jogável. Não inclui licenças de clubes, atletas reais, multiplayer, modo carreira, narração ou assets AAA.

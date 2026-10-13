# Copiloto: escopo e fontes das respostas

O Copiloto do STRATO explica informações já autorizadas para o usuário. Ele não amplia acessos, não aprova crédito e não executa comandos materiais.

## O que entra na resposta

- operações das empresas e veículos permitidos ao usuário;
- títulos da carteira dessas mesmas empresas;
- cedentes associados às operações ou aos títulos visíveis;
- políticas vinculadas às empresas permitidas.

O navegador envia somente a pergunta. Antes da consulta ao provedor de inteligência, o servidor lê as fontes diretamente do banco, confere o tenant e o escopo empresarial e remove qualquer campo que não pertença ao contrato autorizado.

## Quando uma informação não aparece

Se uma empresa não estiver no perfil do usuário, os seus dados não são enviados ao Copiloto. A resposta deve informar que o dado não está disponível no contexto autorizado.

Para solicitar acesso, um administrador deve revisar **Configurações > Usuários e acessos > Escopo empresarial**. A permissão de consultar cadastros é independente da permissão de editar cadastros.

## Limites do recurso

- os cálculos e decisões continuam nos motores determinísticos do STRATO;
- textos recebidos de cadastros e documentos são tratados como dados, não como instruções;
- perguntas e contexto possuem limites de tamanho para reduzir abuso e respostas imprecisas;
- informações ausentes não devem ser inventadas.

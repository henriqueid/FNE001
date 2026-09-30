"use client";
/**
 * Barra do formulário de digitação: indica se é um novo título ou uma edição e
 * abre/recolhe o formulário.
 */

export function EntryEditorBar({
  editorOpen,
  editing,
  documentNumber,
  onToggle,
}: {
  editorOpen: boolean;
  editing: boolean;
  documentNumber: string;
  onToggle: () => void;
}) {
  return (
    <div className={`entry-editor-bar ${editorOpen ? "open" : ""}`}>
      <div>
        <span>{editing ? "EDITANDO TÍTULO" : "DIGITAÇÃO"}</span>
        <strong>
          {editing
            ? `Documento ${documentNumber || "sem número"}`
            : editorOpen
              ? "Novo título"
              : "Formulário recolhido"}
        </strong>
        <small>
          {editorOpen
            ? "Todos os dados do título ficam disponíveis abaixo."
            : "Abra quando precisar incluir ou alterar um título."}
        </small>
      </div>
      <button onClick={onToggle}>
        {editorOpen ? "Fechar formulário" : editing ? "Continuar edição" : "+ Novo título"}
      </button>
    </div>
  );
}

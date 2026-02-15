'use client';

import { type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Link2,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Undo2,
  Redo2,
  FileCode,
  TableProperties,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback } from 'react';

interface EditorToolbarProps {
  editor: Editor;
  onSourceToggle: () => void;
  isSourceView: boolean;
  onImageUpload: () => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-6 w-px bg-border" />;
}

function LinkPopover({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(editor.getAttributes('link').href || '');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    onClose();
  }

  return (
    <div className="absolute top-full left-0 z-50 mt-1 rounded-md border bg-popover p-3 shadow-md">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="h-8 w-64 rounded-sm border bg-background px-2 text-sm"
        />
        <button
          type="submit"
          className="h-8 rounded-sm bg-rlc-red px-3 text-sm text-white hover:bg-rlc-red/90"
        >
          {url ? 'Apply' : 'Remove'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-sm border px-3 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

function YouTubePopover({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
    onClose();
  }

  return (
    <div className="absolute top-full left-0 z-50 mt-1 rounded-md border bg-popover p-3 shadow-md">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="h-8 w-72 rounded-sm border bg-background px-2 text-sm"
        />
        <button
          type="submit"
          className="h-8 rounded-sm bg-rlc-red px-3 text-sm text-white hover:bg-rlc-red/90"
        >
          Embed
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-sm border px-3 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

function TableDropdown({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const isTable = editor.isActive('table');

  return (
    <div className="absolute top-full left-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-md min-w-[180px]">
      {!isTable ? (
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <TableIcon className="h-4 w-4" />
          Insert 3x3 Table
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => { editor.chain().focus().addRowAfter().run(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Rows3 className="h-4 w-4" />
            Add Row Below
          </button>
          <button
            type="button"
            onClick={() => { editor.chain().focus().addColumnAfter().run(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Columns3 className="h-4 w-4" />
            Add Column Right
          </button>
          <button
            type="button"
            onClick={() => { editor.chain().focus().deleteRow().run(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Rows3 className="h-4 w-4 text-destructive" />
            Delete Row
          </button>
          <button
            type="button"
            onClick={() => { editor.chain().focus().deleteColumn().run(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Columns3 className="h-4 w-4 text-destructive" />
            Delete Column
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => { editor.chain().focus().toggleHeaderRow().run(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <TableProperties className="h-4 w-4" />
            Toggle Header Row
          </button>
          <button
            type="button"
            onClick={() => { editor.chain().focus().deleteTable().run(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete Table
          </button>
        </>
      )}
    </div>
  );
}

export function EditorToolbar({ editor, onSourceToggle, isSourceView, onImageUpload }: EditorToolbarProps) {
  const [showLink, setShowLink] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => {
    setShowLink(false);
    setShowYoutube(false);
    setShowTable(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        closeAll();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeAll]);

  return (
    <div
      ref={toolbarRef}
      className="relative flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/50 px-2 py-1"
    >
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Inline formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Headings */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Text alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Lists & blockquote */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Link */}
      <div className="relative">
        <ToolbarButton
          onClick={() => { closeAll(); setShowLink(!showLink); }}
          active={editor.isActive('link')}
          title="Insert Link"
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        {showLink && <LinkPopover editor={editor} onClose={() => setShowLink(false)} />}
      </div>

      {/* Image */}
      <ToolbarButton onClick={onImageUpload} title="Upload Image">
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>

      {/* YouTube */}
      <div className="relative">
        <ToolbarButton
          onClick={() => { closeAll(); setShowYoutube(!showYoutube); }}
          title="Embed YouTube Video"
        >
          <YoutubeIcon className="h-4 w-4" />
        </ToolbarButton>
        {showYoutube && <YouTubePopover editor={editor} onClose={() => setShowYoutube(false)} />}
      </div>

      {/* Table */}
      <div className="relative">
        <ToolbarButton
          onClick={() => { closeAll(); setShowTable(!showTable); }}
          active={editor.isActive('table')}
          title="Table"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        {showTable && <TableDropdown editor={editor} onClose={() => setShowTable(false)} />}
      </div>

      {/* Code block */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
        <Code className="h-4 w-4" />
      </ToolbarButton>

      {/* Horizontal Rule */}
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Source view toggle */}
      <ToolbarButton onClick={onSourceToggle} active={isSourceView} title="View HTML Source">
        <FileCode className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

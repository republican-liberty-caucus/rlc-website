'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/upload';
import { EditorToolbar } from '@/components/admin/editor-toolbar';

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onError?: (message: string) => void;
  className?: string;
}

export function RichTextEditor({ initialContent, onChange, onDirtyChange, onError, className }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [isSourceView, setIsSourceView] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');
  const hasChangedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        codeBlock: false,
      }),
      HorizontalRule,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-rlc-red underline cursor-pointer' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg border' },
        allowBase64: false,
      }),
      Youtube.configure({
        HTMLAttributes: { class: 'rounded-lg border' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[350px]',
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file || file.size > 5 * 1024 * 1024) return true;
            uploadFile(file)
              .then((url) => {
                editor?.chain().focus().setImage({ src: url }).run();
              })
              .catch(() => {
                onError?.('Image paste failed — please try uploading manually.');
              });
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html);
      if (!hasChangedRef.current) {
        hasChangedRef.current = true;
        onDirtyChange?.(true);
      }
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync source view back to editor
  const handleSourceToggle = useCallback(() => {
    if (!editor) return;
    if (isSourceView) {
      // Leaving source view — apply source HTML back to editor
      editor.commands.setContent(sourceHtml);
      onChange(sourceHtml);
    } else {
      // Entering source view — capture current editor HTML
      setSourceHtml(editor.getHTML());
    }
    setIsSourceView(!isSourceView);
  }, [editor, isSourceView, sourceHtml, onChange]);

  const handleImageUpload = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) return;
      try {
        const url = await uploadFile(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        onError?.('Image upload failed — please try again.');
      }
    };
    input.click();
  }, [editor, onError]);

  if (!mounted || !editor) {
    return (
      <div className={cn('min-h-[400px] rounded-md border bg-background p-4 text-sm text-muted-foreground', className)}>
        Loading editor...
      </div>
    );
  }

  const chars = editor.storage.characterCount.characters();
  const words = editor.storage.characterCount.words();

  return (
    <div className={cn('rounded-md', className)}>
      <EditorToolbar
        editor={editor}
        onSourceToggle={handleSourceToggle}
        isSourceView={isSourceView}
        onImageUpload={handleImageUpload}
      />

      {isSourceView ? (
        <textarea
          value={sourceHtml}
          onChange={(e) => {
            setSourceHtml(e.target.value);
            if (!hasChangedRef.current) {
              hasChangedRef.current = true;
              onDirtyChange?.(true);
            }
          }}
          className={cn(
            'w-full min-h-[400px] rounded-b-md border bg-background p-4',
            'font-mono text-sm',
            'focus:border-slate-400 focus:outline-none dark:focus:border-slate-500'
          )}
          spellCheck={false}
        />
      ) : (
        <div
          className={cn(
            'rounded-b-md border bg-background',
            'prose prose-sm max-w-none dark:prose-invert p-4',
            'prose-headings:text-foreground prose-a:text-rlc-red',
            'prose-img:rounded-lg prose-img:border',
            'prose-table:border-collapse prose-td:border prose-td:p-2 prose-th:border prose-th:p-2 prose-th:bg-muted',
            'focus-within:border-slate-400 dark:focus-within:border-slate-500'
          )}
        >
          <EditorContent editor={editor} />

          {/* Bubble Menu on text selection */}
          <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md"
          >
            <BubbleButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')}
              title="Underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </BubbleButton>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <BubbleButton
              onClick={() => {
                const url = editor.getAttributes('link').href;
                const newUrl = prompt('Enter URL:', url || '');
                if (newUrl !== null) {
                  if (newUrl) {
                    editor.chain().focus().extendMarkRange('link').setLink({ href: newUrl }).run();
                  } else {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  }
                }
              }}
              active={editor.isActive('link')}
              title="Link"
            >
              <Link2 className="h-4 w-4" />
            </BubbleButton>
          </BubbleMenu>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-end gap-4 px-2 py-1 text-xs text-muted-foreground">
        <span>{words} words</span>
        <span>{chars} characters</span>
      </div>
    </div>
  );
}

function BubbleButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-sm cursor-pointer',
        'hover:bg-accent',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

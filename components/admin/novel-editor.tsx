'use client';

import { useEffect, useState } from 'react';
import {
  EditorRoot,
  EditorContent,
  EditorCommand,
  EditorCommandList,
  EditorCommandItem,
  EditorCommandEmpty,
  EditorBubble,
  EditorBubbleItem,
  type EditorContentProps,
  handleImageDrop,
  handleImagePaste,
  createImageUpload,
  handleCommandNavigation,
  createSuggestionItems,
  renderItems,
  Command,
  UpdatedImage,
  StarterKit,
  Placeholder,
  TiptapLink,
  TiptapUnderline,
  Youtube,
  HorizontalRule,
  CustomKeymap,
} from 'novel';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/upload';

const uploadFn = createImageUpload({
  onUpload: uploadFile,
  validateFn: (file) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File must be less than 5MB');
    }
  },
});

const slashCommandItems = createSuggestionItems([
  {
    title: 'Heading 1',
    description: 'Large section heading',
    searchTerms: ['title', 'h1', 'heading'],
    icon: <Heading1 className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    searchTerms: ['subtitle', 'h2'],
    icon: <Heading2 className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    searchTerms: ['h3'],
    icon: <Heading3 className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create an unordered list',
    searchTerms: ['unordered', 'list', 'bullets'],
    icon: <List className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create an ordered list',
    searchTerms: ['ordered', 'list', 'numbers'],
    icon: <ListOrdered className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Blockquote',
    description: 'Add a quote block',
    searchTerms: ['quote', 'blockquote'],
    icon: <Quote className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Image',
    description: 'Upload an image',
    searchTerms: ['photo', 'picture', 'image', 'upload'],
    icon: <ImageIcon className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        if (input.files?.[0]) {
          const pos = editor.view.state.selection.from;
          uploadFn(input.files[0], editor.view, pos);
        }
      };
      input.click();
    },
  },
  {
    title: 'YouTube',
    description: 'Embed a YouTube video',
    searchTerms: ['video', 'youtube', 'embed'],
    icon: <YoutubeIcon className="h-5 w-5" />,
    command: ({ editor, range }) => {
      const url = prompt('Enter YouTube URL:');
      if (url) {
        editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run();
      }
    },
  },
  {
    title: 'Divider',
    description: 'Insert a horizontal rule',
    searchTerms: ['hr', 'divider', 'separator', 'line'],
    icon: <Minus className="h-5 w-5" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
]);

const extensions = [
  StarterKit.configure({
    horizontalRule: false,
    codeBlock: false,
  }),
  HorizontalRule,
  TiptapLink.configure({
    HTMLAttributes: { class: 'text-rlc-red underline cursor-pointer' },
  }),
  UpdatedImage.configure({
    HTMLAttributes: { class: 'rounded-lg border' },
  }),
  Placeholder.configure({
    placeholder: 'Start writing, or type "/" for commands...',
  }),
  TiptapUnderline,
  Youtube.configure({
    HTMLAttributes: { class: 'rounded-lg border' },
  }),
  CustomKeymap,
  Command.configure({
    suggestion: {
      items: () => slashCommandItems,
      render: renderItems,
    },
  }),
];

interface NovelEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  className?: string;
}

export function NovelEditor({ initialContent, onChange, className }: NovelEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn('min-h-[400px] rounded-md border bg-background p-4 text-sm text-muted-foreground', className)}>
        Loading editor...
      </div>
    );
  }

  return (
    <EditorRoot>
      <EditorContent
        className={cn(
          'relative min-h-[400px] rounded-md border bg-background p-4',
          'prose prose-sm max-w-none dark:prose-invert',
          'prose-headings:text-foreground prose-a:text-rlc-red',
          'prose-img:rounded-lg prose-img:border',
          'focus-within:border-rlc-red focus-within:ring-1 focus-within:ring-rlc-red',
          className
        )}
        extensions={extensions}
        editorProps={{
          handleDOMEvents: {
            keydown: (_view, event) => handleCommandNavigation(event),
          },
          handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
          handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
          attributes: {
            class: 'outline-none min-h-[350px]',
          },
        }}
        onCreate={({ editor }) => {
          if (initialContent) {
            editor.commands.setContent(initialContent);
          }
        }}
        onUpdate={({ editor }) => {
          onChange(editor.getHTML());
        }}
      >
        {/* Slash Command Menu */}
        <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          <EditorCommandEmpty className="px-2 py-1.5 text-sm text-muted-foreground">
            No results
          </EditorCommandEmpty>
          <EditorCommandList>
            {slashCommandItems.map((item) => (
              <EditorCommandItem
                key={item.title}
                value={item.title}
                onCommand={(val) => item.command?.(val)}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
                  {item.icon}
                </div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </EditorCommandItem>
            ))}
          </EditorCommandList>
        </EditorCommand>

        {/* Bubble Menu (appears on text selection) */}
        <EditorBubble
          tippyOptions={{ placement: 'top' }}
          className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md"
        >
          <BubbleButton
            action={(editor) => editor.chain().focus().toggleBold().run()}
            icon={<Bold className="h-4 w-4" />}
          />
          <BubbleButton
            action={(editor) => editor.chain().focus().toggleItalic().run()}
            icon={<Italic className="h-4 w-4" />}
          />
          <BubbleButton
            action={(editor) => editor.chain().focus().toggleUnderline().run()}
            icon={<Underline className="h-4 w-4" />}
          />
          <BubbleButton
            action={(editor) => editor.chain().focus().toggleStrike().run()}
            icon={<Strikethrough className="h-4 w-4" />}
          />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <BubbleButton
            action={(editor) => {
              const url = prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            icon={<Link2 className="h-4 w-4" />}
          />
        </EditorBubble>
      </EditorContent>
    </EditorRoot>
  );
}

function BubbleButton({
  action,
  icon,
}: {
  action: (editor: Parameters<NonNullable<EditorContentProps['onUpdate']>>[0]['editor']) => void;
  icon: React.ReactNode;
}) {
  return (
    <EditorBubbleItem
      onSelect={action}
      className="flex h-7 w-7 items-center justify-center rounded-sm hover:bg-accent cursor-pointer"
    >
      {icon}
    </EditorBubbleItem>
  );
}

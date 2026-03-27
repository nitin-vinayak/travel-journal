import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import styles from './RichTextEditor.module.css'

export default function RichTextEditor({ initialContent, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown())
    },
  })

  if (!editor) return null

  const btn = (active, action, label) => (
    <button
      type="button"
      className={`${styles.btn} ${active ? styles.active : ''}`}
      onClick={action}
    >{label}</button>
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        {btn(editor.isActive('bold'),          () => editor.chain().focus().toggleBold().run(),                'B')}
        {btn(editor.isActive('italic'),        () => editor.chain().focus().toggleItalic().run(),              'I')}
        {btn(editor.isActive('strike'),        () => editor.chain().focus().toggleStrike().run(),              'S̶')}
        <span className={styles.divider} />
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Large')}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Small')}
        <span className={styles.divider} />
        {btn(editor.isActive('bulletList'),    () => editor.chain().focus().toggleBulletList().run(),          '•')}
        {btn(editor.isActive('orderedList'),   () => editor.chain().focus().toggleOrderedList().run(),         '1.')}
      </div>
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  )
}

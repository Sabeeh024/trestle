import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Design Tokens/Colors",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-10 shrink-0 rounded-md border border-border"
        style={{ background: `var(${varName})` }}
      />
      <div>
        <p className="text-sm font-semibold text-text-primary">{name}</p>
        <p className="font-mono text-xs text-text-disabled">{varName}</p>
      </div>
    </div>
  );
}

const semanticGroups: { title: string; tokens: { name: string; varName: string }[] }[] = [
  {
    title: "Background",
    tokens: [
      { name: "background", varName: "--background" },
      { name: "background-subtle", varName: "--background-subtle" },
      { name: "background-muted", varName: "--background-muted" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "text-primary", varName: "--text-primary" },
      { name: "text-secondary", varName: "--text-secondary" },
      { name: "text-disabled", varName: "--text-disabled" },
      { name: "text-inverse", varName: "--text-inverse" },
    ],
  },
  {
    title: "Border",
    tokens: [
      { name: "border", varName: "--border" },
      { name: "border-strong", varName: "--border-strong" },
    ],
  },
  {
    title: "Action",
    tokens: [
      { name: "action-primary", varName: "--action-primary" },
      { name: "action-primary-hover", varName: "--action-primary-hover" },
      { name: "action-primary-text", varName: "--action-primary-text" },
    ],
  },
  {
    title: "Feedback",
    tokens: [
      { name: "feedback-success", varName: "--feedback-success" },
      { name: "feedback-success-bg", varName: "--feedback-success-bg" },
      { name: "feedback-warning", varName: "--feedback-warning" },
      { name: "feedback-warning-bg", varName: "--feedback-warning-bg" },
      { name: "feedback-danger", varName: "--feedback-danger" },
      { name: "feedback-danger-bg", varName: "--feedback-danger-bg" },
    ],
  },
];

const categoricalColors = [
  { name: "purple", className: "bg-categorical-purple-light dark:bg-categorical-purple-dark" },
  { name: "cyan", className: "bg-categorical-cyan-light dark:bg-categorical-cyan-dark" },
  { name: "green", className: "bg-categorical-green-light dark:bg-categorical-green-dark" },
  { name: "orange", className: "bg-categorical-orange-light dark:bg-categorical-orange-dark" },
  { name: "blue", className: "bg-categorical-blue-light dark:bg-categorical-blue-dark" },
  { name: "pink", className: "bg-categorical-pink-light dark:bg-categorical-pink-dark" },
];

export const Semantic: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-text-secondary">
        Semantic tokens hold their full color value in a CSS variable, so they respond to
        light/dark mode at runtime — toggle the theme in the toolbar above to see them change.
      </p>
      {semanticGroups.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-text-primary">{group.title}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {group.tokens.map((token) => (
              <Swatch key={token.varName} name={token.name} varName={token.varName} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

export const Categorical: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Used for project color-coding (e.g. <code>bg-categorical-purple-light dark:bg-categorical-purple-dark</code>).
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {categoricalColors.map((color) => (
          <div key={color.name} className="flex items-center gap-3">
            <div className={`size-10 shrink-0 rounded-md border border-border ${color.className}`} />
            <p className="text-sm font-semibold text-text-primary capitalize">{color.name}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

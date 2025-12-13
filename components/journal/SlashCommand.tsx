import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";

interface CommandItemProps {
  title: string;
  icon: any;
  command: (props: { editor: any; range: any }) => void;
}

interface CommandListProps {
  items: CommandItemProps[];
  command: any;
  editor: any;
  range: any;
}

const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    },
    [props]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex(
          (selectedIndex + props.items.length - 1) % props.items.length
        );
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 overflow-hidden min-w-[240px] p-1 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex flex-col">
        {props.items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              className={`cursor-pointer flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md transition-colors ${
                index === selectedIndex
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => selectItem(index)}
            >
              <div className={`p-1 rounded border ${index === selectedIndex ? 'bg-white border-slate-300' : 'bg-white border-slate-200 text-slate-400'}`}>
                <Icon size={16} strokeWidth={1.5} />
              </div>
              <span className="font-medium">{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

CommandList.displayName = "CommandList";

const renderItems = () => {
  let component: ReactRenderer | any;
  let popup: any;

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
        animation: "shift-away",
        zIndex: 9999,
      });
    },

    onUpdate: (props: any) => {
      component.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup[0].setProps({
        getReferenceClientRect: props.clientRect,
      });
    },

    onKeyDown: (props: any) => {
      if (props.event.key === "Escape") {
        popup[0].hide();
        return true;
      }
      // component.ref is the verified ref from forwardRef now
      return component.ref?.onKeyDown(props);
    },

    onExit: () => {
      popup[0].destroy();
      component.destroy();
    },
  };
};

const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: "Large heading",
      icon: Heading1,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "Medium heading",
      icon: Heading2,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "Small heading",
      icon: Heading3,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      title: "Bulleted list",
      icon: List,
      command: ({ editor, range }: any) => {
        editor.chain().focus()
          .deleteRange(range)
          .toggleBulletList()
          .run();
      },
    },
    {
      title: "Numbered list",
      icon: ListOrdered,
      command: ({ editor, range }: any) => {
        editor.chain().focus()
          .deleteRange(range)
          .toggleOrderedList()
          .run();
      },
    },
    {
      title: "Block quote",
      icon: Quote,
      command: ({ editor, range }: any) => {
        editor.chain().focus()
          .deleteRange(range)
          .toggleBlockquote()
          .run();
      },
    },
  ]
    .filter((item) =>
        item.title.toLowerCase().startsWith(query.toLowerCase())
    )
    .slice(0, 10);
};

export const slashCommandConfig = {
  suggestion: {
    items: getSuggestionItems,
    render: renderItems,
  },
};

export default SlashCommand;

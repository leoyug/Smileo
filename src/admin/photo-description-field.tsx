import { fields } from "@keystatic/core";
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Text } from "@keystar/ui/typography";
import { Flex } from "@keystar/ui/layout";

export const PHOTO_FILENAME_EVENT = "local-photo-filename";
type SlugField = ReturnType<typeof fields.slug>;
const TRANSLATE_SLUG = "__photo_translation__";

function PhotoDescriptionInput({ field, ...props }: ComponentProps<SlugField["Input"]> & { field: SlugField }) {
  const host = useRef<HTMLDivElement>(null);
  const automatic = useRef<string | undefined>(undefined);
  const pending = useRef<AbortController | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [status, setStatus] = useState("");
  const cancel = () => {
    pending.current?.abort();
    pending.current = null;
    setStatus("");
  };
  useLayoutEffect(() => () => pending.current?.abort(), []);
  useLayoutEffect(() => { cancel(); }, [props.value.name, props.value.slug]);
  const generate = async () => {
    if (pending.current) return;
    if (!props.value.name.trim()) { setStatus("请先填写画面描述。"); return; }
    const controller = new AbortController();
    pending.current = controller;
    setStatus("正在生成英文短名…");
    try {
      const response = await fetch("/api/photo-slug", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: props.value.name }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "短名生成失败，请重试。");
      if (typeof result.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)) throw new Error("未能生成英文短名，请重试。");
      if (controller.signal.aborted) return;
      latest.current.onChange({ ...latest.current.value, slug: result.slug });
      setStatus("");
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "短名生成失败，请重试。");
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };
  useLayoutEffect(() => {
    const form = host.current?.closest("form");
    const update = (event: Event) => {
      if (props.value.name !== "" && props.value.name !== automatic.current) return;
      const filename = (event as CustomEvent<string | null>).detail;
      if (filename === null && automatic.current === undefined) return;
      const name = (filename ?? "").split(/[\\/]/).pop()!
        .replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
      automatic.current = filename === null ? undefined : name;
      cancel();
      // A filename supplies a description, not a replacement for a stable URL.
      props.onChange({ ...props.value, name });
    };
    form?.addEventListener(PHOTO_FILENAME_EVENT, update);
    return () => form?.removeEventListener(PHOTO_FILENAME_EVENT, update);
  }, [props.value, props.onChange]);
  const NativeInput = field.Input;
  return <Flex ref={host} direction="column" gap="medium" aria-busy={pending.current !== null}><NativeInput {...props} onChange={value => {
    if (value.name !== props.value.name) {
      automatic.current = undefined;
      cancel();
      // Native automatic generation is synchronous; only the explicit button translates.
      props.onChange({ ...value, slug: props.value.slug });
      return;
    }
    if (value.slug.startsWith(TRANSLATE_SLUG)) { void generate(); return; }
    cancel();
    props.onChange(value);
  }} />{status && <Text role="status" aria-live="polite" size="small" color="neutralSecondary">{status}</Text>}</Flex>;
}

export function photoDescription(options: Parameters<typeof fields.slug>[0]) {
  // Route native Regenerate through the asynchronous translator while retaining
  // Keystatic's fields, duplicate-slug validation and saved-value serialization.
  const field = fields.slug(options);
  const inputField = fields.slug({ ...options, slug: { ...options.slug, generate: () => TRANSLATE_SLUG } });
  return { ...field, Input: (props: ComponentProps<SlugField["Input"]>) => <PhotoDescriptionInput field={inputField} {...props} /> };
}

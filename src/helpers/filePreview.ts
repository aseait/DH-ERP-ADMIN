const URL_MAP: Record<string, string> = {
  'https://dh-app-files.oss-cn-beijing.aliyuncs.com': 'https://filepreview.dhsupplychain.cn',
  'https://dh-app-files-live.oss-cn-hongkong.aliyuncs.com': 'https://file-preview.dhsupplychain.cn',
};

const OFFICE_EXTS = new Set(['.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt']);

export const resolvePreviewUrl = (input: any): string => {
  let u = '';

  if (typeof input === 'string') u = input;
  else u = input?.file_url || input?.url || input?.fileUrl || '';

  if (!u) return '';

  for (const k in URL_MAP) {
    if (u.startsWith(k)) return u.replace(k, URL_MAP[k]);
  }
  return u;
};

function getFileExt(url: string): string {
  const path = url.split('?')[0];
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot).toLowerCase() : '';
}

export const openPreview = (input: any) => {
  const u = resolvePreviewUrl(input);
  if (!u) return;

  const ext = getFileExt(u);
  if (OFFICE_EXTS.has(ext)) {
    window.open(
        `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(u)}`,
        '_blank'
    );
  } else {
    window.open(u, '_blank');
  }
};

export const extractFilePrefix = (filename?: string) => {
  if (!filename) return '';
  return filename.split('_')[0] || filename;
};

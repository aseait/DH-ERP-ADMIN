import { extractFilePrefix, openPreview } from '../../helpers/filePreview';
import React from 'react';
import { FileRow } from '../../pages/OrderLists/OrderDetails/MarineDetails';

const FileMini = ({ file, viewLabel }: { file: FileRow | null; viewLabel: string }) => {
  if (!file?.file_url) return <div className="md-muted">—</div>;

  return (
    <div className="md-fileMini">
      <button className="md-link" type="button" onClick={() => openPreview(file)}>
        {viewLabel}
      </button>

      {file?.file_id ? (
        <div className="md-fileMini__meta">
          <strong>{extractFilePrefix(file.fileName || file.original_file_name)}</strong>
          {file.duties_and_taxes != null ? (
            <span className="md-money">CA${file.duties_and_taxes}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default FileMini;

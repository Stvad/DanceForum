// @ts-check (uses JSDoc types for type checking)

import Command from '@ckeditor/ckeditor5-core/src/command';
import Writer from '@ckeditor/ckeditor5-engine/src/model/writer';
import RootElement from '@ckeditor/ckeditor5-engine/src/model/rootelement';
import { modelQueryElement } from './utils';
import { ATTRIBUTES, ELEMENTS } from './constants';

export default class InsertFootnoteCommand extends Command {
	/**
	 *
	 * @param {{footnoteId: number}} props
	 */
	execute({ footnoteId } = { footnoteId: 0 }) {
		this.editor.model.change(writer => {
			const doc = this.editor.model.document;
			const rootElement = doc.getRoot();
			if (!rootElement) {
				return;
			}
			const footnoteSection = this._getFootnoteSection(writer, rootElement);
			const id = footnoteId === 0 ? footnoteSection.maxOffset + 1 : footnoteId;
			doc.selection.isBackward ?
				writer.setSelection(doc.selection.anchor) :
				writer.setSelection(doc.selection.focus);
			const footnoteReference = writer.createElement(ELEMENTS.footnoteReference, { [ATTRIBUTES.footnoteId]: id });
			this.editor.model.insertContent(footnoteReference);
			writer.setSelection(footnoteReference, 'after');
			// if referencing an existing footnote
			if (footnoteId !== 0) {
				return;
			}

			const footnoteContents = writer.createElement(ELEMENTS.footnoteContents);
			const footnoteLabel = writer.createElement(
				ELEMENTS.footnoteLabel,
				//fn{id} is the format used by our existing markdown footnotes
				{ [ATTRIBUTES.footnoteId]: id, id: `fn${id}` },
			);
			const div = writer.createElement(ELEMENTS.footnoteItem);
			const p = writer.createElement('paragraph');
			writer.append(footnoteLabel, div);
			writer.append(p, footnoteContents);
			writer.append(footnoteContents, div)

			// There must be at least one paragraph for the description to be editable.
			// See https://github.com/ckeditor/ckeditor5/issues/1464.
			//writer.appendElement('paragraph', footnoteContents);

			this.editor.model.insertContent(div, writer.createPositionAt(footnoteSection, footnoteSection.maxOffset));
		});
	}

	refresh() {
		const model = this.editor.model;
		const lastPosition = model.document.selection.getLastPosition();
		const allowedIn = lastPosition && model.schema.findAllowedParent(lastPosition, ELEMENTS.footnoteSection);
		this.isEnabled = allowedIn !== null;
	}

	/**
	 * @param {Writer} writer
	 * @param {RootElement} rootElement
	 * @returns
	 */
	_getFootnoteSection(writer, rootElement) {
		const footnoteSection = modelQueryElement(this.editor, rootElement, element =>  element.name === ELEMENTS.footnoteSection);
		if(footnoteSection) {
			return footnoteSection;
		}
		const newFootnoteSection = writer.createElement(
			ELEMENTS.footnoteSection,
		);
		this.editor.model.insertContent(newFootnoteSection, writer.createPositionAt(rootElement, rootElement.maxOffset));
		return newFootnoteSection;
	}
}
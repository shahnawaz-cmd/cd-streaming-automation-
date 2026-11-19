import { PreviewPage } from '../pages/preview';
import { SelectedYmmt } from '../pages/preview/EditYmmModalComponent';
import { Logger } from '../utils/Logger';

/**
 * Layer 3: EditYmmModule
 * Encapsulates the complete business action for updating vehicle YMMT details.
 * Ensures zero boilerplate in test specifications.
 */
export class EditYmmModule {
  private logger = new Logger('EditYmmModule');

  constructor(private previewPage: PreviewPage) {}

  /**
   * Complete business workflow:
   * 1. Opens Edit modal / form via self-healing trigger.
   * 2. Dynamically cascades selection across Year -> Make -> Model -> Trim.
   * 3. Verifies Trim field is displayed & interactive (Checklist #02).
   * 4. Submits the updated details.
   */
  async updateDynamicYmmt(): Promise<SelectedYmmt> {
    const editModal = this.previewPage.editYmm;
    await editModal.open();
    const selection = await editModal.selectDynamicYmmt();
    await editModal.submitUpdate();
    this.logger.pass(
      `✅ Successfully updated YMMT: ${selection.year} ${selection.make} ${selection.model} (${selection.trim})`
    );
    return selection;
  }
}

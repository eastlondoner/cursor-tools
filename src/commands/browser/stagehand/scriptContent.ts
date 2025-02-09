import { STAGEHAND_SCRIPT } from './stagehandScript';
import { once } from '../../../utils/once';

export const scriptContent = once(() => STAGEHAND_SCRIPT);

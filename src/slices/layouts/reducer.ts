import { createSlice } from '@reduxjs/toolkit';
// constants
import {
  LAYOUT_TYPES,
  LAYOUT_MODE_TYPES,
  LAYOUT_SIDEBAR_TYPES,
  LAYOUT_WIDTH_TYPES,
  LAYOUT_POSITION_TYPES,
  LAYOUT_TOPBAR_THEME_TYPES,
  LEFT_SIDEBAR_SIZE_TYPES,
  LEFT_SIDEBAR_VIEW_TYPES,
  LEFT_SIDEBAR_IMAGE_TYPES,
  PERLOADER_TYPES,
  SIDEBAR_VISIBILITY_TYPES,
} from '../../Components/constants/layout';

export interface LayoutState {
  layoutType:
    | LAYOUT_TYPES.HORIZONTAL
    | LAYOUT_TYPES.VERTICAL
    | LAYOUT_TYPES.TWOCOLUMN
    | LAYOUT_TYPES.SEMIBOX;
  layoutModeType: LAYOUT_MODE_TYPES.LIGHTMODE | LAYOUT_MODE_TYPES.DARKMODE;
  leftSidebarType:
    | LAYOUT_SIDEBAR_TYPES.LIGHT
    | LAYOUT_SIDEBAR_TYPES.DARK
    | LAYOUT_SIDEBAR_TYPES.GRADIENT
    | LAYOUT_SIDEBAR_TYPES.GRADIENT_2
    | LAYOUT_SIDEBAR_TYPES.GRADIENT_3
    | LAYOUT_SIDEBAR_TYPES.GRADIENT_4;
  layoutWidthType: LAYOUT_WIDTH_TYPES.FLUID | LAYOUT_WIDTH_TYPES.BOXED;
  layoutPositionType: LAYOUT_POSITION_TYPES.FIXED | LAYOUT_POSITION_TYPES.SCROLLABLE;
  topbarThemeType: LAYOUT_TOPBAR_THEME_TYPES.LIGHT | LAYOUT_TOPBAR_THEME_TYPES.DARK;
  leftsidbarSizeType:
    | LEFT_SIDEBAR_SIZE_TYPES.DEFAULT
    | LEFT_SIDEBAR_SIZE_TYPES.COMPACT
    | LEFT_SIDEBAR_SIZE_TYPES.SMALLICON
    | LEFT_SIDEBAR_SIZE_TYPES.SMALLHOVER;
  leftSidebarViewType: LEFT_SIDEBAR_VIEW_TYPES.DEFAULT | LEFT_SIDEBAR_VIEW_TYPES.DETACHED;
  leftSidebarImageType:
    | LEFT_SIDEBAR_IMAGE_TYPES.NONE
    | LEFT_SIDEBAR_IMAGE_TYPES.IMG1
    | LEFT_SIDEBAR_IMAGE_TYPES.IMG2
    | LEFT_SIDEBAR_IMAGE_TYPES.IMG3
    | LEFT_SIDEBAR_IMAGE_TYPES.IMG4;
  preloader: PERLOADER_TYPES.ENABLE | PERLOADER_TYPES.DISABLE;
  sidebarVisibilitytype: SIDEBAR_VISIBILITY_TYPES.SHOW | SIDEBAR_VISIBILITY_TYPES.HIDDEN;
}

/**
 * ✅ Corrected initialState
 * - Default layout: VERTICAL
 * - layoutModeType uses LAYOUT_MODE_TYPES
 * - leftSidebarType uses LAYOUT_SIDEBAR_TYPES
 */
export const initialState: LayoutState = {
  layoutType: LAYOUT_TYPES.VERTICAL, // <- default vertical
  leftSidebarType: LAYOUT_SIDEBAR_TYPES.DARK, // sidebar theme enum
  layoutModeType: (localStorage.getItem('layoutModeType') as LAYOUT_MODE_TYPES) || LAYOUT_MODE_TYPES.LIGHTMODE,

  layoutWidthType: LAYOUT_WIDTH_TYPES.FLUID,
  layoutPositionType: LAYOUT_POSITION_TYPES.FIXED,
  topbarThemeType: LAYOUT_TOPBAR_THEME_TYPES.DARK,
  leftsidbarSizeType: LEFT_SIDEBAR_SIZE_TYPES.DEFAULT,
  leftSidebarViewType: LEFT_SIDEBAR_VIEW_TYPES.DEFAULT,
  leftSidebarImageType: LEFT_SIDEBAR_IMAGE_TYPES.NONE,
  preloader: PERLOADER_TYPES.DISABLE,
  sidebarVisibilitytype: SIDEBAR_VISIBILITY_TYPES.HIDDEN,
};

const LayoutSlice = createSlice({
  name: 'LayoutSlice',
  initialState,
  reducers: {
    changeLayoutAction(state, action) {
      state.layoutType = action.payload;
    },
    changeLayoutModeAction(state, action) {
      state.layoutModeType = action.payload;
    },
    changeSidebarThemeAction(state, action) {
      state.leftSidebarType = action.payload;
    },
    changeLayoutWidthAction(state, action) {
      state.layoutWidthType = action.payload;
    },
    changeLayoutPositionAction(state, action) {
      state.layoutPositionType = action.payload;
    },
    changeTopbarThemeAction(state, action) {
      state.topbarThemeType = action.payload;
    },
    changeLeftsidebarSizeTypeAction(state, action) {
      state.leftsidbarSizeType = action.payload;
    },
    changeLeftsidebarViewTypeAction(state, action) {
      state.leftSidebarViewType = action.payload;
    },
    changeSidebarImageTypeAction(state, action) {
      state.leftSidebarImageType = action.payload;
    },
    changePreLoaderAction(state, action) {
      state.preloader = action.payload;
    },
    changeSidebarVisibilityAction(state, action) {
      state.sidebarVisibilitytype = action.payload;
    },
  },
});

export const {
  changeLayoutAction,
  changeLayoutModeAction,
  changeSidebarThemeAction,
  changeLayoutWidthAction,
  changeLayoutPositionAction,
  changeTopbarThemeAction,
  changeLeftsidebarSizeTypeAction,
  changeLeftsidebarViewTypeAction,
  changeSidebarImageTypeAction,
  changePreLoaderAction,
  changeSidebarVisibilityAction,
} = LayoutSlice.actions;

export default LayoutSlice.reducer;

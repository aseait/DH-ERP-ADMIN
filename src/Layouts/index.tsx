import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import withRouter from '../Components/Common/withRouter';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// import Components
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import RightSidebar from '../Components/Common/RightSidebar';
import { useTT } from '../helpers/useTT';
import { APP_BASE_TITLE, getPageTitleKey } from '../helpers/pageTitle';

// import actions
import {
  changeLayout,
  changeSidebarTheme,
  changeLayoutMode,
  changeLayoutWidth,
  changeLayoutPosition,
  changeTopbarTheme,
  changeLeftsidebarSizeType,
  changeLeftsidebarViewType,
  changeSidebarImageType,
  changeSidebarVisibility,
} from '../slices/thunks';

// redux
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from 'reselect';

const Layout = (props: any) => {
  const [headerClass, setHeaderClass] = useState('');
  const dispatch: any = useDispatch();
  const { tt, i18n } = useTT();

  useEffect(() => {
    const pathname = props.router?.location?.pathname;
    const key = pathname ? getPageTitleKey(pathname) : undefined;
    document.title = key ? `${tt(key)} | DH ERP` : APP_BASE_TITLE;
  }, [props.router?.location?.pathname, tt, i18n.language]);

  const selectLayoutState = (state: any) => state.Layout;
  const selectLayoutProperties = createSelector(selectLayoutState, (layout) => ({
    layoutType: layout.layoutType,
    leftSidebarType: layout.leftSidebarType,
    layoutModeType: layout.layoutModeType,
    layoutWidthType: layout.layoutWidthType,
    layoutPositionType: layout.layoutPositionType,
    topbarThemeType: layout.topbarThemeType,
    leftsidbarSizeType: layout.leftsidbarSizeType,
    leftSidebarViewType: layout.leftSidebarViewType,
    leftSidebarImageType: layout.leftSidebarImageType,
    preloader: layout.preloader,
    sidebarVisibilitytype: layout.sidebarVisibilitytype,
  }));

  const {
    layoutType,
    leftSidebarType,
    layoutModeType,
    layoutWidthType,
    layoutPositionType,
    topbarThemeType,
    leftsidbarSizeType,
    leftSidebarViewType,
    leftSidebarImageType,
    sidebarVisibilitytype,
  } = useSelector(selectLayoutProperties);

  /*
      layout settings
    */
  useEffect(() => {
    if (
      layoutType ||
      leftSidebarType ||
      layoutModeType ||
      layoutWidthType ||
      layoutPositionType ||
      topbarThemeType ||
      leftsidbarSizeType ||
      leftSidebarViewType ||
      leftSidebarImageType ||
      sidebarVisibilitytype
    ) {
      window.dispatchEvent(new Event('resize'));
      dispatch(changeLeftsidebarViewType(leftSidebarViewType));
      dispatch(changeLeftsidebarSizeType(leftsidbarSizeType));
      dispatch(changeSidebarTheme(leftSidebarType));
      dispatch(changeLayoutMode(layoutModeType));
      dispatch(changeLayoutWidth(layoutWidthType));
      dispatch(changeLayoutPosition(layoutPositionType));
      dispatch(changeTopbarTheme(topbarThemeType));
      dispatch(changeLayout(layoutType));
      dispatch(changeSidebarImageType(leftSidebarImageType));
      dispatch(changeSidebarVisibility(sidebarVisibilitytype));
    }
  }, [
    layoutType,
    leftSidebarType,
    layoutModeType,
    layoutWidthType,
    layoutPositionType,
    topbarThemeType,
    leftsidbarSizeType,
    leftSidebarViewType,
    leftSidebarImageType,
    sidebarVisibilitytype,
    dispatch,
  ]);

  /*
      call dark/light mode
    */
  const onChangeLayoutMode = useCallback(
    (value: any) => {
      if (changeLayoutMode) {
        dispatch(changeLayoutMode(value));
      }
    },
    [dispatch]
  );

  // class add/remove in header
  const scrollNavigation = useCallback(() => {
    const scrollup = document.documentElement.scrollTop;
    if (scrollup > 50) {
      setHeaderClass('topbar-shadow');
    } else {
      setHeaderClass('');
    }
  }, []);

  // ✅ IMPORTANT FIX:
  // before: this effect runs EVERY render, adds infinite listeners => slower
  // now: add ONCE + cleanup
  useEffect(() => {
    window.addEventListener('scroll', scrollNavigation, true);
    // run once initially
    scrollNavigation();

    return () => {
      window.removeEventListener('scroll', scrollNavigation, true);
    };
  }, [scrollNavigation]);

  useEffect(() => {
    const humberIcon = document.querySelector('.hamburger-icon') as HTMLElement | null;

    if (!humberIcon) return;

    if (
      sidebarVisibilitytype === 'show' ||
      layoutType === 'vertical' ||
      layoutType === 'twocolumn'
    ) {
      humberIcon.classList.remove('open');
    } else {
      humberIcon.classList.add('open');
    }
  }, [sidebarVisibilitytype, layoutType]);

  return (
    <React.Fragment>
      <div id="layout-wrapper">
        <Header
          headerClass={headerClass}
          layoutModeType={layoutModeType}
          onChangeLayoutMode={onChangeLayoutMode}
        />
        <Sidebar layoutType={layoutType} />
        <div className="main-content">
          {props.children}
          <Footer />
        </div>
      </div>
      <RightSidebar />
      <ToastContainer position="top-right" autoClose={3000} />
    </React.Fragment>
  );
};

Layout.propTypes = {
  children: PropTypes.object,
};

export default withRouter(Layout);

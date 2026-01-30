import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { scaleWidth, scaleHeight, scaleFont } from '@/utils/responsive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Keep the feed item height locked to the current window height so paging/scroll snapping
// remains consistent, but make spacing/typography scale with device size.
const spacing = scaleWidth;

const AVATAR_SIZE = scaleWidth(45);
const AVATAR_BORDER_RADIUS = AVATAR_SIZE / 2;
const PLUS_ICON_SIZE = scaleWidth(25);

export const feedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.text,
  },
  propertyContainer: {
    height: SCREEN_HEIGHT,
    position: 'relative' as const,
  },
  videoTouchArea: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    // On iOS, the native video surface can float above RN subviews unless the
    // containing layer is significantly elevated.
    zIndex: 100,
    elevation: 100,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  floatingActionsBar: {
    position: 'absolute' as const,
    right: spacing(12),
    bottom: scaleHeight(140),
    zIndex: 210,
    elevation: 210,
    flexDirection: 'column',
    gap: spacing(12),
    alignItems: 'center',
  },
  globalFooterBar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    //backgroundColor: '#000000',
    zIndex: 200,
    elevation: 200,
  },
  footerMainContent: {
    flexDirection: 'row',
    paddingHorizontal: spacing(16),
    paddingTop: scaleHeight(12),
    paddingBottom: scaleHeight(12),
    marginBottom: scaleHeight(12),
    marginRight: spacing(66),
    gap: spacing(16),
    //backgroundColor: '#000000',
  },
  footerLeftContent: {
    flex: 1,
    gap: spacing(4),
    justifyContent: 'center',
  },
  footerTitle: {
    color: '#FFFFFF',
    fontSize: scaleFont(18),
    fontWeight: '700',
    lineHeight: scaleFont(20),
  },
  footerPrice: {
    color: '#FFFFFF',
    fontSize: scaleFont(16),
    fontWeight: '700',
    lineHeight: scaleFont(18),
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: scaleFont(11),
    fontWeight: '600',
  },
  footerSmallText: {
    color: '#FFFFFF',
    fontSize: scaleFont(12),
    fontWeight: '400',
    opacity: 0.9,
  },
  footerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
  },
  footerDetailsRow: {
    flexDirection: 'row',
    gap: spacing(8),
  },
  footerDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  footerActionsBar: {
    flexDirection: 'column',
    gap: spacing(12),
    alignItems: 'center',
    paddingRight: spacing(8),
  },
   iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    marginRight:5
  },
  footerActionButton: {
    alignItems: 'center',
    gap: spacing(1),
  },
  footerActionText: {
    color: '#FFFFFF',
    fontSize: scaleFont(10),
    fontWeight: '600',
  },
  translationContainer: {
    marginBottom: scaleHeight(4),
    gap: spacing(2),
  },
  agentSection: {
    alignItems: 'center',
    gap: spacing(8),
  },
  agentAvatarContainer: {
    position: 'absolute' as const, //relative
    bottom: -(SCREEN_HEIGHT * 0.41),
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleWidth(10),
  },
  agentAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_BORDER_RADIUS,
    backgroundColor: Colors.textLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: spacing(2),
    borderColor: '#85C8CC',
    marginRight: scaleWidth(8),
  },
  agentPlusIcon: {
    position: 'absolute' as const,
    bottom: -spacing(-30), //3
    right: -spacing(2),
    width: PLUS_ICON_SIZE,
    height: PLUS_ICON_SIZE,
    borderRadius: PLUS_ICON_SIZE / 2,
    backgroundColor: '#9E1E1D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: spacing(0.5),
    borderColor: '#8c0707ff',
    marginRight: scaleWidth(4),
  },
  agentInitial: {
    color: Colors.text,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  progressBarContainer: {
    width: '100%',
    height: scaleHeight(3),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(32),
  },
  emptyTitle: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(8),
  },
  emptyText: {
    fontSize: scaleFont(16),
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

import { message } from "ant-design-vue";
import { useNavigator } from "../common/use-navigator";
import { usePageLoading } from "../common/use-page-loading";
import { use1688Page } from "../site/1688/1688";
import { useAboutBlankPage } from "../site/about-blank";
import { usePddPage } from "../site/pdd/pdd";
import { useTaobaoTmallPage } from "../site/taobao-tmall/taobao-tm";

console.log('浏览器加载成功!')

useNavigator()
usePageLoading()

message.config({
  top: "120px"
})

if (location.href === 'about:blank') {
  useAboutBlankPage();
}
if (location.href.startsWith('https://')) {
  if (location.href.includes('taobao.com') || location.href.includes('tmall.com')) {
    useTaobaoTmallPage()
  }
  if (location.href.includes('1688.com')) {
    use1688Page()
  }
}
if (location.href.startsWith('https://mobile.yangkeduo.com') || location.href.startsWith('https://mobile.pinduoduio.com')) {
  usePddPage()
}

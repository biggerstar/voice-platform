import { message } from "ant-design-vue";
import { useNavigator } from "../common/use-navigator";
import { usePageLoading } from "../common/use-page-loading";
import { useAboutBlankPage } from "../site/about-blank";
import { useDaiDai } from "../site/daidai/use-daidai";

console.log('浏览器加载成功!')

useNavigator()
usePageLoading()

message.config({
  top: "120px"
})

if (location.href === 'about:blank') {
  useAboutBlankPage();
}

if (location.href.startsWith('https://play.daidaimeta.com')) {
  useDaiDai()
}

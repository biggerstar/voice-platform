import { protocol, type Session } from "electron";

const privileges: Electron.Privileges = {
  standard: true,
  secure: false,
  bypassCSP: true,
  supportFetchAPI: true,
  corsEnabled: true,
  allowServiceWorkers: true,
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'http',
    privileges
  },
  {
    scheme: 'https',
    privileges
  },
])


/**
 * 为某个持久化窗口注册网络拦截
*/
export function registerSchemesFingerprintBySession(
  session: Session,
  requestCallback: (request: Request) => Promise<Request | Response>,
  responseCallback: (request: Request, response: Response) => Promise<Response>
): void {
  const _requestCallback = async function (_request: Request) {
    const hostCookie = await session.cookies.get({ url: _request.url })
    const hostCookieString = hostCookie.map(cookie => `${cookie.name}=${cookie.value}`).join(';')
    if (hostCookie.length) _request.headers.append('cookie', hostCookieString)
    // console.log(_request.method, _request.url, _request.headers, _request.body)
    return requestCallback(_request)
  }

  if (!session.protocol.isProtocolHandled('http')) {
    session.protocol.handle('http', async (_request) => {
      const requestOrResponse: Request | Response = await _requestCallback(_request)
      return responseCallback(
        _request,
        requestOrResponse instanceof Response ? requestOrResponse : await fetch(requestOrResponse)
      )
    })
  }

  if (!session.protocol.isProtocolHandled('https')) {
    session.protocol.handle('https', async (_request) => {
      const requestOrResponse: Request | Response = await _requestCallback(_request)
      return responseCallback(
        _request,
        requestOrResponse instanceof Response ? requestOrResponse : await fetch(requestOrResponse)
      )
    })
  }
}

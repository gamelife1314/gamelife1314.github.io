---
title: K8S 证书管理
date: 2024-02-29 09:35:32
tags:
    - 证书
    - cert-manager
    - mkcert
    - openssl
categories:
    - k8s
---


本篇文章主要简单讲解TLS证书的基本知识以及如何在K8S中使用证书提供安全服务。

### 证书

TLS证书用于证明访问目标的有效性，当访问某个网站时，浏览器会自动验证证书是否有效，并且会通过证书中提供的Server公钥和Server协商出用于接下来安全数据传输的对称加密秘钥。浏览器（或者客户端，例如：`curl`）验证服务端证书的流程如下：

1. 浏览器或者客户端在和服务端建立加密通信的流程中，会下载服务端的证书到本地，这个证书中包含了服务端证书的公钥，并且这个证书会使用可信任的CA机构的私钥进行签名；
2. 浏览器或者操作系统中安装了大多数著名机构的根证书，浏览器或者客户端会使用这些机构根证书的公钥验证收到的证书是否是可信任机构颁发的；
3. 如果浏览器或者客户端收到的证书是有效的，紧接着会验证证书中包含的服务器或者IP地址是不是和当前打开的地址匹配；
4. 紧接着浏览器会和服务端协商出用于本次数据加密的对称秘钥，使用对称秘钥一是这个秘钥是在每次数据通信时动态协商出来的，会话结束就是小了，防止公钥泄漏带来的安全问题，而是对称加解密密相比非对称加解密有更好的性能表现；

`X.509` 公钥证书中有一些常用的扩展名，如下所示是它们的含义：

- `.csr`：证书请求文件，是由 RFC 2986定义的`PKCS10`格式，包含部分/全部的请求证书的信息，比如，主题, 机构，国家等，并且包含了请求证书的公玥，这些被`CA`中心签名后返回一张证书，返回的证书是公钥证书（只包含公玥不含私钥）；
- `.pem`：是一种容器格式，可能仅包含公钥证书，也可以包含完整的证书链（包括公玥，私钥，和根证书）。也可能用来编码 CSR文件；
- `.key`：就是一个`pem`格式只包含私玥的文件，`.key` 作为文件名只是作为一个明显的别名；
- `.pkcs12 .pfx .p12`：`pkcs`即 RSA定义的公玥密码学(`Public-Key Cryptography Standards`)标准，有多个标准`pkcs12`只是其一，是描述个人信息交换语法标准，有的文件直接使用其作为文件后缀名。这种文件包含公钥和私玥证书对，跟`pem`文件不同的是，它的内容是完全加密的。用`openssl`可以把其转换成包含公玥和私玥的`.pem`文件。命令：`openssl pkcs12 -in file-to-convert.p12 -out converted-file.pem -nodes`；
- `.der`：`der`是`ASN.1`众多编码方案中的一个，使用`der`编码方案编码的`pem`文件。`der`编码是使用二进制编码，一般`pem`文件使用的是`base64`进行编码，所以完全可以把`der`编码的文件转换成`pem`文件，命令：`openssl x509 -inform der -in to-convert.der -out converted.pem` 使用`der`编码的`pem`文件，后缀名可以为`.der`，也可以为 `.cert .cer .crt`；
- `.cert .cer .crt`：`pem`或者`der`编码格式的证书文件，这些文件后缀名都会被`windows`资源管理器认为是证书文件。有趣的是, `.pem` 反而不会被认为是证书文件；

<!-- more -->

#### openssl

本节使用 `openssl` 生成自签名的证书，首先第一步生成 `CA` 证书的私钥及其证书文件：

> `openssl req -x509 -sha256 -days 356 -nodes -newkey rsa:2048 -subj "/CN=ca.local.dev/C=CN/L=SH" -keyout rootCA.key -out rootCA.crt`

证书的公约是可以从证书文件`rootCA.crt`解析出来的使用如下命令：

> `openssl x509 -inform pem -in rootCA.crt -pubkey -noout`

```
$ openssl x509 -inform pem -in rootCA.crt -pubkey -noout
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2gI2HyMaiheUr/vkhoX3
Cp7Fy5dOl0eSOxQPOscK4svUopEwke1sme8h/e8NWNgnqGKmsa+lqg4Y8q3WDTdG
Z1CA7dI5QKFQUQyFU1gqanJBSx0Bzsa+QvrwFt2BMCw05tvowfOa9PxPgGs+k+Oj
E5Me/0vmznidUm31NHQZinCCLXYBrVD7GFfXFNZjOqJmV4v5EWkoP/FL7zJ+7uz6
tjfI4paxn6su2qf88eAUq4ZmsS3cxjvWY4EqiJok8R4x5ln0Pg1RYz8kPV8cfMZc
rdsncoks0XXOU6MMfWzvA3dWSYAPGsef9Ehy8u+7DsWBPyECGksQ7X+QX3oQrWnz
VQIDAQAB
-----END PUBLIC KEY-----
```

生成`Server`的私钥以及证书请求文件：

> `openssl req -newkey rsa:2048 -nodes -days 365 -keyout server.key -out server.csr`

```
$ openssl req -newkey rsa:2048 -nodes -days 365 -keyout server.key -out server.csr
....
-----
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [AU]:CN
State or Province Name (full name) [Some-State]:SH
Locality Name (eg, city) []:PU DONG
Organization Name (eg, company) [Internet Widgits Pty Ltd]:HW
Organizational Unit Name (eg, section) []:TEC
Common Name (e.g. server FQDN or YOUR name) []:test.local.dev
Email Address []:

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
An optional company name []:
```

根据`server.csr`生成证书，并且使用`rootCA.key`进行签名：

```
$ openssl x509 -req -days 365 -set_serial 01 -in server.csr -out server.crt \
> -CA rootCA.crt -CAkey rootCA.key -extensions SAN \
> -extfile <(printf "\n[SAN]\nsubjectAltName=DNS:test.local.dev,IP:127.0.0.1\nextendedKeyUsage=serverAuth")
Certificate request self-signature ok
subject=C = CN, ST = SH, L = PU DONG, O = HW, OU = TEC, CN = test.local.dev
```

至此生成了`CA`和`Server`的私钥和证书文件。使用如下的一段`python`代码启用`https`服务器：

> `pip install Flask`

```py
from flask import Flask
app = Flask(__name__)

@app.route('/hello')
def hello_world():
    return 'Hello World!'
    
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8091, ssl_context=('server.crt', 'server.key'))
```

启动`Server`：

> `python3 server.py`

```
$ python3 server.py
 * Serving Flask app 'server'
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on all addresses (0.0.0.0)
 * Running on https://127.0.0.1:8091
 * Running on https://172.19.106.26:8091
Press CTRL+C to quit
```

打开另外一个终端使用`curl`命令进行测试：

> `curl https://127.0.0.1:8091/hello`

```
$ curl https://127.0.0.1:8091/hello
curl: (60) SSL certificate problem: unable to get local issuer certificate
More details here: https://curl.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the web page mentioned above.
```

这里显示找不到证书签名的机构，没法对证书进行验证，这是因为没把自签名的根证书放入系统的证书链中：

> `cp rootCA.crt /usr/local/share/ca-certificates`
> `sudo update-ca-certificates`

再次使用 `curl` 命令进行验证正确返回结果：

```
$ curl https://127.0.0.1:8091/hello
Hello World!
```

#### mkcert

除了使用 `openssl` 工具进行证书的创建，还可以使用[mkcert](https://github.com/FiloSottile/mkcert)这个开源工具进行证书的创建，下载之后，首先安装根证书到系统的证书链中，执行下面的命令：

> `mkcert -install`

```
$ mkcert -install
The local CA is already installed in the system trust store! 👍
The local CA is already installed in Java's trust store! 👍
```

然后生成服务端的证书文件：

> `mkcert --cert-file test1.server.crt -key-file test1.server.key test1.local.dev localhost 127.0.0.1 ::1`

```
$ mkcert --cert-file test1.server.crt -key-file test1.server.key test1.local.dev localhost 127.0.0.1 ::1

Created a new certificate valid for the following names 📜
 - "test1.local.dev"
 - "localhost"
 - "127.0.0.1"
 - "::1"

The certificate is at "test1.server.crt" and the key at "test1.server.key" ✅

It will expire on 29 May 2026 🗓
```

使用下面的命令查看证书的内容：

> `openssl x509 -in test1.server.crt -noout -text`

```
$ openssl x509 -in test1.server.crt -noout -text
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            ec:29:52:0f:3c:c4:7d:63:d1:aa:97:43:a9:e2:4a:61
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: O = mkcert development CA, OU = root@F00596107-PX, CN = mkcert root@F00596107-PX
        Validity
            Not Before: Feb 29 06:39:56 2024 GMT
            Not After : May 29 06:39:56 2026 GMT
        Subject: O = mkcert development certificate, OU = root@F00596107-PX
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)
                Modulus:
                    00:af:df:c7:21:0e:02:5d:b7:63:8d:ee:ea:89:72:
                    1a:74:ec:3c:d3:aa:c2:6e:1c:1d:bf:db:64:0a:a6:
                    6a:6b:cd:58:8e:49:42:d8:a4:b2:db:de:c6:d8:73:
                    d2:bc:a2:51:5e:1e:89:8d:89:21:96:d2:02:1d:93:
                    86:a5:1c:59:cb:4e:b2:75:84:3f:95:3a:75:9c:d9:
                    79:13:f2:12:1f:de:61:5d:19:ee:40:16:6d:a8:2a:
                    3c:f0:91:c2:7e:72:ab:87:ce:8b:41:54:35:24:d4:
                    9a:2b:a1:00:59:da:75:d2:5b:c0:c5:6b:d9:c3:de:
                    7e:2a:64:32:03:7f:67:76:a4:0f:00:6b:ab:c2:51:
                    b3:b6:e1:2b:6b:b6:28:f2:2f:1a:c2:71:0e:3b:fd:
                    ff:86:c1:0e:fc:95:fe:34:38:83:62:83:b8:cb:df:
                    4b:2e:30:f2:cc:3d:39:bb:cd:c8:82:f2:d3:28:68:
                    7d:dd:aa:8a:bf:6e:48:dc:e9:f2:a8:42:83:24:dd:
                    76:86:db:bd:5d:0e:f9:cd:76:3a:1b:d1:9a:0e:ff:
                    85:8b:24:c1:76:55:93:43:26:77:51:56:a8:0b:51:
                    07:0f:17:77:f9:1c:e3:aa:41:e8:ea:f9:6b:ec:cb:
                    77:0f:a9:ac:4d:0d:6b:a7:00:4b:7b:1d:04:d9:9c:
                    e8:c3
                Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Key Usage: critical
                Digital Signature, Key Encipherment
            X509v3 Extended Key Usage:
                TLS Web Server Authentication
            X509v3 Authority Key Identifier:
                68:7C:66:79:31:AC:0C:88:BA:5D:58:86:BD:94:A3:89:95:D3:B2:2F
            X509v3 Subject Alternative Name:
                DNS:test1.local.dev, DNS:localhost, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1
    Signature Algorithm: sha256WithRSAEncryption
    Signature Value:
        2a:1d:9a:e4:5a:9b:d4:73:d5:b0:6b:61:fe:f7:64:ba:95:d9:
        10:06:f0:bd:39:70:0a:a2:8a:f1:b9:eb:b1:96:00:bf:ab:67:
        31:31:27:d9:4e:e8:94:9c:35:31:cd:25:c9:92:62:b8:8e:b7:
        5e:3b:b5:9a:ac:fc:f0:2f:d0:cd:a9:65:f0:74:0f:a7:ef:75:
        e2:1b:0f:82:d2:ad:1d:fc:72:42:42:de:dc:1e:dc:0e:ff:c0:
        3f:34:b8:77:dd:d6:39:bf:b4:ba:bc:58:c6:2d:5f:0d:ef:de:
        f4:87:d7:64:e0:6d:39:c7:5a:07:20:a3:31:50:51:13:9b:e1:
        b2:c0:17:f6:97:51:96:d4:84:07:62:24:ce:89:d6:1c:5b:cf:
        9a:c3:90:96:94:bb:04:ed:88:cd:0a:94:e7:51:00:2c:86:48:
        de:16:fb:2b:b5:c7:c6:10:d3:8f:2c:9c:3e:dc:f0:7a:ae:ca:
        24:b0:8f:a1:60:a3:9b:7a:9c:7f:5f:9a:4a:17:81:dd:b2:19:
        d9:54:d3:dd:b5:17:e7:08:15:9b:0d:8f:28:01:6e:bb:42:0f:
        e6:2d:70:87:70:41:51:45:94:fa:6e:c3:21:a8:50:ad:44:28:
        28:b7:4a:0c:f6:40:b7:09:c7:b4:28:af:11:1e:74:67:43:cb:
        e6:88:1d:3f:41:1f:fb:e4:8a:dc:73:0b:ff:f9:43:6a:fc:94:
        cb:e8:4e:c9:41:03:66:00:84:b6:17:1b:eb:d4:0e:b3:c6:bd:
        1c:0d:1a:18:58:01:c3:72:89:48:f6:41:18:aa:d0:ba:db:46:
        5e:09:0f:b5:7e:6b:45:6b:9a:35:5c:71:dc:e0:a7:63:08:1f:
        4e:09:9b:78:fc:4b:37:62:83:09:a2:db:e2:64:d6:70:6e:0d:
        97:35:4b:f4:02:94:a6:5a:7d:35:d7:9c:66:d2:2f:01:7a:7a:
        65:41:dd:b3:02:81:5a:df:31:e4:b6:2b:09:0a:cf:15:20:f0:
        81:19:ed:2a:4c:d7
```

### K8S TLS 证书

假设我们使用如下的方式创建了一个 `Ingress` 服务，然后使用不同的方式进行创建`TLS`证书并加载（这部分要求安装 `nginx ingress controller` 和 `metalb`）：

> kubectl create ns ingress-tls
> kubectl create -n ingress-tls  deployment whoami --image=traefik/whoami -r 3 --port=80
> kubectl expose -n ingress-tls deployment whoami --port=8080 --target-port=80 --type=ClusterIP --name=whoami
```
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami-ingress
  namespace: ingress-tls
spec:
  ingressClassName: nginx
  rules:
    - host: "whoami.svc.local"
      http:
        paths:
          - pathType: Prefix
            path: "/"
            backend:
              service:
                name: whoami
                port:
                  number: 8080
EOF
```

查看 `ingress` 的入口地址：

> `kubectl get svc -n ingress-nginx ingress-nginx-controller`

```
$ kubectl get svc -n ingress-nginx ingress-nginx-controller
NAME                       TYPE           CLUSTER-IP    EXTERNAL-IP     PORT(S)                      AGE
ingress-nginx-controller   LoadBalancer   10.43.81.43   172.31.46.242   80:32664/TCP,443:30949/TCP   42h
```

此时，可以使用直接使用 `http` 协议进行访问：

```
$ curl --resolve whoami.svc.local:80:172.31.46.242 http://whoami.svc.local
Hostname: whoami-7f89db7768-gxxtj
IP: 127.0.0.1
IP: 10.42.0.103
RemoteAddr: 10.42.0.89:43916
GET / HTTP/1.1
Host: whoami.svc.local
User-Agent: curl/7.81.0
Accept: */*
X-Forwarded-For: 10.42.0.1
X-Forwarded-Host: whoami.svc.local
X-Forwarded-Port: 80
X-Forwarded-Proto: http
X-Forwarded-Scheme: http
X-Real-Ip: 10.42.0.1
X-Request-Id: 67e2b1c6c3c0024c1fe40862d79f70b3
X-Scheme: http
```

#### mkcert

使用 `mkcert` 创建证书：

> ` mkcert --cert-file whoami.svc.local.crt -key-file whoami.svc.local.key whoami.svc.local 172.31.46.242`

然后创建 `tls` 类型的 `secret`，包含新创建的证书内容：

> `kubectl create -n ingress-tls secret tls mkcert-tls-secret --cert=whoami.svc.local.crt --key=whoami.svc.local.key`

紧接着更新创建的 `Ingress`，增加 `tls` 配置：

```
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami-ingress
  namespace: ingress-tls
spec:
  ingressClassName: nginx
  rules:
    - host: "whoami.svc.local"
      http:
        paths:
          - pathType: Prefix
            path: "/"
            backend:
              service:
                name: whoami
                port:
                  number: 8080
  tls:
    - hosts:
        - "whoami.svc.local"
      secretName: mkcert-tls-secret
EOF
```

此时，如果还使用`http`协议访问，已经会被永久重定向：

> `curl -i --resolve whoami.svc.local:80:172.31.46.242 http://whoami.svc.local`

```
$ curl -i --resolve whoami.svc.local:80:172.31.46.242 http://whoami.svc.local
HTTP/1.1 308 Permanent Redirect
Date: Thu, 29 Feb 2024 07:47:51 GMT
Content-Type: text/html
Content-Length: 164
Connection: keep-alive
Location: https://whoami.svc.local

<html>
<head><title>308 Permanent Redirect</title></head>
<body>
<center><h1>308 Permanent Redirect</h1></center>
<hr><center>nginx</center>
</body>
</html>
```

使用 `https` 协议进行访问，返回结果符合预期：

```
$ curl -i --resolve whoami.svc.local:443:172.31.46.242 https://whoami.svc.local
HTTP/2 200
date: Thu, 29 Feb 2024 07:53:34 GMT
content-type: text/plain; charset=utf-8
content-length: 400
strict-transport-security: max-age=15724800; includeSubDomains

Hostname: whoami-7f89db7768-d7w4h
IP: 127.0.0.1
IP: 10.42.0.104
RemoteAddr: 10.42.0.89:46044
GET / HTTP/1.1
Host: whoami.svc.local
User-Agent: curl/7.81.0
Accept: */*
X-Forwarded-For: 10.42.0.1
X-Forwarded-Host: whoami.svc.local
X-Forwarded-Port: 443
X-Forwarded-Proto: https
X-Forwarded-Scheme: https
X-Real-Ip: 10.42.0.1
X-Request-Id: f88938a75b95d1189b31204488da205a
X-Scheme: https
```

#### cert-manager

使用 [cert-manager](https://cert-manager.io/docs/) 可以自动的生成证书并且应用到 `Ingress` 或者 `Gateway` 中，使用 `cert-manager` 的第一步是安装，支持多种安装方式，这里使用如下方式：

> `kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.yaml`

等待所有 `Pod` 就绪:

```
$ kubectl get pods --namespace cert-manager

NAME                                       READY   STATUS    RESTARTS   AGE
cert-manager-5c6866597-zw7kh               1/1     Running   0          2m
cert-manager-cainjector-577f6d9fd7-tr77l   1/1     Running   0          2m
cert-manager-webhook-787858fcdb-nlzsq      1/1     Running   0          2m
```

##### 自签名证书

使用 `cert-manaer` 前提是先要配置`Issuer`或者`ClusterIssuer`，前者属于命名空间资源，后者属于集群资源，为了简单测试，这里先试用自签名证书进行演示：

```
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: selfsigned-issuer
  namespace: ingress-tls
spec:
  selfSigned: {}
EOF
issuer.cert-manager.io/selfsigned-issuer created
```

更新`Ingress`，使用自签名的`Issuer`自动生成证书并且配置，`metadata.annotations.cert-manager.io/issuer: selfsigned-issuer` 表示引用的 `Issuer`，`tls`中的`secret`表示生成的证书保存在哪个`secret`中：

```
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami-ingress
  namespace: ingress-tls
  annotations:
    cert-manager.io/issuer: selfsigned-issuer
spec:
  ingressClassName: nginx
  rules:
    - host: "whoami.svc.local"
      http:
        paths:
          - pathType: Prefix
            path: "/"
            backend:
              service:
                name: whoami
                port:
                  number: 8080
  tls:
    - hosts:
        - "whoami.svc.local"
      secretName: selfsigned-issuer-secret
EOF
```

命令执行成功之后，可以看到自动生成的证书中还包含了`ca.crt`：

```
$ kubectl describe secret -n ingress-tls selfsigned-issuer-secret
Name:         selfsigned-issuer-secret
Namespace:    ingress-tls
Labels:       controller.cert-manager.io/fao=true
Annotations:  cert-manager.io/alt-names: whoami.svc.local
              cert-manager.io/certificate-name: selfsigned-issuer-secret
              cert-manager.io/common-name:
              cert-manager.io/ip-sans:
              cert-manager.io/issuer-group: cert-manager.io
              cert-manager.io/issuer-kind: Issuer
              cert-manager.io/issuer-name: selfsigned-issuer
              cert-manager.io/uri-sans:

Type:  kubernetes.io/tls

Data
====
ca.crt:   1029 bytes
tls.crt:  1029 bytes
tls.key:  1675 bytes
```

如果不把这里的 `ca.crt` 存放到系统的证书链中，访问 `whoami.svc.local`，就会出现自签名证书不能被信任，连接建立失败的提示：

```
$ curl -i --resolve whoami.svc.local:443:172.31.46.242 https://whoami.svc.local
curl: (60) SSL certificate problem: self-signed certificate
More details here: https://curl.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the web page mentioned above.
```

有两种解决方案，一种是在访问的时候添加`-k`参数，表示忽略证书验证，一种是将`selfsigned-issuer-secret`中的`ca.crt`保存到系统的证书链中。

##### CA Issuer

可以将外部创建的已经受信任的`CA`根证书上传到`k8s`中，然后使用该`CA`证书签名生成新的证书。例如，在上面的实验中，已经将 `mkcert` 的根证书安装到了系统中，现在将它也上传到`cert-manager`中，用于签发新的证书，也可以使用 `openssl` 创建的根证书。首先使用下面的命令查看根证书和私钥的位置：

```
$ mkcert -CAROOT
/root/.local/share/mkcert
$ ll /root/.local/share/mkcert
-r-------- 1 root root 2484 Jan 17 17:29 rootCA-key.pem
-rw-r--r-- 1 root root 1639 Jan 17 17:29 rootCA.pem
```

将 `mkcert` 的根证书以 `Secret` 的形式保存到集群中：

> `kubectl create -n ingress-tls secret tls mkcert-ca-secret --cert=/root/.local/share/mkcert/rootCA.pem --key=/root/.local/share/mkcert/rootCA-key.pem`

```
$ kubectl describe secret -n ingress-tls mkcert-ca-secret
Name:         mkcert-ca-secret
Namespace:    ingress-tls
Labels:       <none>
Annotations:  <none>

Type:  kubernetes.io/tls

Data
====
tls.key:  2484 bytes
tls.crt:  1639 bytes
```

然后创建的新的`Issuer`，指定使用 `mkcert-ca-secret` 这个根证书：

```
$ kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: mkcert-ca-issuer
  namespace: ingress-tls
spec:
  ca:
    secretName: mkcert-ca-secret
EOF
```

更新 `whoami-ingress`，使用新建的 `mkcert-ca-issuer` 进行证书签发：

```
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami-ingress
  namespace: ingress-tls
  annotations:
    cert-manager.io/issuer: mkcert-ca-issuer
spec:
  ingressClassName: nginx
  rules:
    - host: "whoami.svc.local"
      http:
        paths:
          - pathType: Prefix
            path: "/"
            backend:
              service:
                name: whoami
                port:
                  number: 8080
  tls:
    - hosts:
        - "whoami.svc.local"
      secretName: mkcert-ca-issuer-secret
EOF
```

现在访问 `https://whoami.svc.local`，不会再有证书验证失败的问题了，因为签发使用的根证书已在系统中安装：

```
$ curl --resolve whoami.svc.local:443:172.31.46.242 https://whoami.svc.local
Hostname: whoami-7f89db7768-8h82h
IP: 127.0.0.1
IP: 10.42.0.105
RemoteAddr: 10.42.0.89:50332
GET / HTTP/1.1
Host: whoami.svc.local
User-Agent: curl/7.81.0
Accept: */*
X-Forwarded-For: 10.42.0.1
X-Forwarded-Host: whoami.svc.local
X-Forwarded-Port: 443
X-Forwarded-Proto: https
X-Forwarded-Scheme: https
X-Real-Ip: 10.42.0.1
X-Request-Id: a742955026ebfb51842b59f13c5c310b
X-Scheme: https
```

### 参考链接

1. https://www.bastionxp.com/blog/how-to-create-self-signed-ssl-tls-x.509-certificates-using-openssl/
2. https://www.cnblogs.com/linianhui/p/security-x509.html
3. https://ubuntu.com/server/docs/security-trust-store

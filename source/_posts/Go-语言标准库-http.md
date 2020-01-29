---
title: 'Go 语言标准库: http'
date: 2017-12-31 18:32:32
categories:
- Go 标准库
tags:
- Go
---


{% asset_img 1.png  Go 语言标准库: http %}

<!-- more -->

### 使用net/http实现一个WEB服务器

```go
package main

import (
	"fmt"
	"log"
	"net/http"
)

type database map[string]int

func main() {
	db := database{"shoes": 50, "socks": 5}
	http.HandleFunc("/list", db.list)
	http.HandleFunc("/price", db.price)
	log.Fatal(http.ListenAndServe("localhost:8000", nil))

}

func printReqInfo(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(w, "%s %s %s\n", req.Method, req.URL, req.Proto)
	for k, v := range req.Header {
		fmt.Fprintf(w, "Header[%q] = %q\n", k, v)
	}
	fmt.Fprintf(w, "Host = %s\n", req.Host)
	fmt.Fprintf(w, "RemoteAddr = %s\n", req.RemoteAddr)
	if err := req.ParseForm(); err != nil {
		log.Print(err)
	}
	for k, v := range req.Form {
		fmt.Fprintf(w, "Form[%s] = %s\n", k, v)
	}
}

func (db database) list(w http.ResponseWriter, req *http.Request) {
	printReqInfo(w, req)
	for item, price := range db {
		fmt.Fprintf(w, "%s: %d\n", item, price)
	}
}

func (db database) price(w http.ResponseWriter, req *http.Request) {
	printReqInfo(w, req)
	item := req.URL.Query().Get("item")
	price, ok := db[item]
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprintf(w, "No such item: %s", item)
		return
	}
	fmt.Fprintf(w, "%d\n", price)
}

```

访问结果：
![result](2.png)


### 使用net/http内建方法发起HTTP请求

```go
package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

func main() {
	resp, err := http.Get("http://weixin.sogou.com")
	if err != nil {
		fmt.Println(err.Error())
	}

	fmt.Printf("Response Status: %d %s\n", resp.StatusCode, resp.Status)
	for k, v := range resp.Header {
		fmt.Printf("Header[%q] = %q\n", k, v)
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Println(err.Error())
	}
	fmt.Println(string(body))
}
```

响应结果:

        Response Status: 200 200 OK
        Header["Date"] = ["Sun, 31 Dec 2017 13:57:02 GMT"]
        Header["P3p"] = ["CP=\"CURa ADMa DEVa PSAo PSDo OUR BUS UNI PUR INT DEM STA PRE COM NAV OTC NOI DSP COR\"" "CP=\"CURa ADMa DEVa PSAo PSDo OUR BUS UNI PUR INT DEM STA PRE COM NAV OTC NOI DSP COR\"" "CP=\"CURa ADMa DEVa PSAo PSDo OUR BUS UNI PUR INT DEM STA PRE COM NAV OTC NOI DSP COR\""]
        Header["Connection"] = ["keep-alive"]
        Header["Set-Cookie"] = ["ABTEST=2|1514728622|v1; expires=Tue, 30-Jan-18 13:57:02 GMT; path=/" "IPLOC=CN3100; expires=Mon, 31-Dec-18 13:57:02 GMT; domain=.sogou.com; path=/" "SUID=808B5E722028940A000000005A48ECAE; expires=Sat, 26-Dec-37 13:57:02 GMT; domain=weixin.sogou.com; path=/"]
        Header["Expires"] = ["Sun, 31 Dec 2017 13:57:02 GMT"]
        Header["Cache-Control"] = ["max-age=0" "no-store" "no-cache"]
        Header["Server"] = ["nginx"]
        Header["Content-Type"] = ["text/html"]
        Header["Vary"] = ["Accept-Encoding"]
        <!doctype html>
        <html>
        <head>
        ...


更高级的方式：

```go
package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"
)

func main() {

	client := &http.Client{
		Transport: &http.Transport{
			Proxy: func(request *http.Request) (*url.URL, error) {
				proxy := &url.URL{
					Scheme: "http",
					User:   url.UserPassword("user", "password"),
					Host:   "server:port",
				}
				return proxy, nil
			},
			DialContext: nil,
			ProxyConnectHeader: http.Header{
				"Proxy-Switch-Ip": {"yes"},
			},
		},
		Timeout: 5 * time.Second,
	}

	req, _ := http.NewRequest("GET", "http://weixin.sogou.com/", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36")
	req.Header.Add("Host", "weixin.sogou.com")
	resp, _ := client.Do(req)
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println(string(body))
}
```
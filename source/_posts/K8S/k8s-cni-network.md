---
title: Kubernetes CNI 网络
date: 2023-12-29 16:07:44
tags:
    - cni
    - multus-cni
    - flannel
    - cni plugin
categories:
    - k8s
---

在[容器网络-跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)中，我们使用`flannel`实现了容器的跨主机通信，在[使用kubeadm创建多借点集群](/2023/12/17/K8S/kubeadm-deploy/#集群初始化)时，在集群初始化之后，首先安装了[`kube-flannel CNI`](https://github.com/flannel-io/flannel)插件，用于`k8s`集群`pod`之间互通，这是集群节点`Ready`的必要条件，因为`k8s`自身并不能实现`pod`之间互通，需要借助[CNI](https://www.cni.dev/docs/spec/)完成此功能。

单机容器通信是将主上的容器通过连接在`docker0`网桥实现，然后跨主机容器通信是通过`vxlan`中的`flannel.x`设备实现跨主机之间的容器通信，`k8s`的`flannel-cni`插件处理不同`pod`之间互通的方式就和跨主机容器通信的方式一样，只不过在`k8s`集群中将用于单机上容器互通的`docker0`网桥换成了`cni0`。

`k8s`之所以要创建一个与`docker0`功能相同的网桥，是因为`k8s`并没有使用`Docker`的网络模型，它并不希望和`Docker`之间有强依赖，所以不具备配置这样一个网桥的能力。

所以在使用`flannel-cni`插件的模式下，`k8s`之间不同`pod`互通的模式下如下图所示，和[容器网络-跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)唯一区别是网桥名称的变化：

{% asset_img k8s-cni-network.png %}

<!-- more -->

### Pod网络创建

在[使用kubeadm创建多借点集群](/2023/12/17/K8S/kubeadm-deploy/#集群初始化)中，使用了如下的命令的来初始化[flannel-cni](https://github.com/flannel-io/flannel) 插件：

> `kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml`

这个过程会在各个节点上创建[flannel-cni](https://github.com/flannel-io/cni-plugin)的配置，并且会运行一个和[容器网络-跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)中`flanneld`相同功能的[Flannel DaemonSet](https://github.com/flannel-io/flannel/blob/e8fb8108622bb9646dc7de84df19adbae319acb8/Documentation/kube-flannel.yml#L106)，`flannel DaemonSet`的配置以[ConfigMap](https://github.com/flannel-io/flannel/blob/e8fb8108622bb9646dc7de84df19adbae319acb8/Documentation/kube-flannel.yml#L98C1-L98C1)的形式创建并且挂到了容器中，如果你初始化`k8s`集群时没有使用`10.244.0.0/16`这个`Pod`网络，就需要修改`kube-flannel.yml`。可以使用如下命令查看配置信息：

> `kubectl describe configmaps -n kube-flannel kube-flannel-cfg`

`flannel-cni`的配置也是放在了`kube-flannel-cfg`中，它最终挂在到了每个节点上的 `/etc/cni/net.d/10-flannel.conflist` 中：

![](flannel-cni-config.png)

还有它会把`flannel-cni`的二进制文件放在节点上的 `/opt/cni/bin/flannel`：

![](flannel-cni-binary.png)

这个配置文件的使用者是`CRI`，在我的集群配置中就是`containerd`，由`CRI`容器运行时负责调用`CNI`实现`Pod`的网络配置。这里要注意的是，目前`k8s`不支持多个`CNI`插件使用，所以即使你在`/etc/cni/net.d/`目录中配置多个`CNI`插件，它也只会加载一个，可以点击查看[containerd 默认配置](https://github.com/containerd/containerd/blob/1f76ca4081424eaba0aae06e66cc5bd4beb0c776/pkg/cri/config/config_unix.go#L61)：

```go
func DefaultConfig() PluginConfig {
    var m map[string]interface{}
	toml.Unmarshal([]byte(defaultRuncV2Opts), &m)

	return PluginConfig{
		CniConfig: CniConfig{
			NetworkPluginBinDir:        "/opt/cni/bin",
			NetworkPluginConfDir:       "/etc/cni/net.d",
			NetworkPluginMaxConfNum:    1, // only one CNI plugin config file will be loaded
			NetworkPluginSetupSerially: false,
			NetworkPluginConfTemplate:  "",
		},
        ...
    }
}
```

在`containerd`启动的过程中，会[读取配置](https://github.com/containerd/containerd/blob/1f76ca4081424eaba0aae06e66cc5bd4beb0c776/pkg/cri/server/service_linux.go#L64)：

```go
func (c *criService) initPlatform() (err error) {
    ....
    c.netPlugin = make(map[string]cni.CNI)
	for name, dir := range pluginDirs {
		max := c.config.NetworkPluginMaxConfNum
		if name != defaultNetworkPlugin {
			if m := c.config.Runtimes[name].NetworkPluginMaxConfNum; m != 0 {
				max = m
			}
		}
		// Pod needs to attach to at least loopback network and a non host network,
		// hence networkAttachCount is 2. If there are more network configs the
		// pod will be attached to all the networks but we will only use the ip
		// of the default network interface as the pod IP.
		i, err := cni.New(cni.WithMinNetworkCount(networkAttachCount),
			cni.WithPluginConfDir(dir),
			cni.WithPluginMaxConfNum(max),
			cni.WithPluginDir([]string{c.config.NetworkPluginBinDir}))
		if err != nil {
			return fmt.Errorf("failed to initialize cni: %w", err)
		}
		c.netPlugin[name] = i
	}
    ....
}
```

当`kubelet`创建`Pod`的时候，它首先调用`containerd`的[RunPodSandbox](https://github.com/containerd/containerd/blob/1f76ca4081424eaba0aae06e66cc5bd4beb0c776/pkg/cri/server/sandbox_run.go#L52)方法创建一个沙盒，在这个沙盒里面创建用于`pod`内网络共享的的命名空间并且设置网络，而`containerd`并不会自己创建网络，它必须调用`flannel-cni`插件来实现，所以在这个 `RunPodSandbox` 中就是准备`flannel-cni` 所需的参数，并且调用它，这部分的实现主要在[setupPodNetwork](https://github.com/containerd/containerd/blob/1f76ca4081424eaba0aae06e66cc5bd4beb0c776/pkg/cri/server/sandbox_run.go#L451)中：

```go
func (c *criService) setupPodNetwork(ctx context.Context, sandbox *sandboxstore.Sandbox) error {
	var (
		id        = sandbox.ID
		config    = sandbox.Config
		path      = sandbox.NetNSPath
		netPlugin = c.getNetworkPlugin(sandbox.RuntimeHandler)
		err       error
		result    *cni.Result
	)
	if netPlugin == nil {
		return errors.New("cni config not initialized")
	}

	opts, err := cniNamespaceOpts(id, config)
	if err != nil {
		return fmt.Errorf("get cni namespace options: %w", err)
	}
	log.G(ctx).WithField("podsandboxid", id).Debugf("begin cni setup")
	netStart := time.Now()
	if c.config.CniConfig.NetworkPluginSetupSerially {
		result, err = netPlugin.SetupSerially(ctx, id, path, opts...)
	} else {
		result, err = netPlugin.Setup(ctx, id, path, opts...)
	}
	networkPluginOperations.WithValues(networkSetUpOp).Inc()
	networkPluginOperationsLatency.WithValues(networkSetUpOp).UpdateSince(netStart)
	if err != nil {
		networkPluginOperationsErrors.WithValues(networkSetUpOp).Inc()
		return err
	}
	logDebugCNIResult(ctx, id, result)
    ...
}
```

### CNI插件参数

从[cni-operations](https://www.cni.dev/docs/spec/#cni-operations)规范我们可以看到，它定义了四种操作：`ADD`，`DEL`，`CHECK` 和 和`VERSION`，其实有用的只有`ADD`，`DEL`，给这两操作传递参数是通过环境变量和标准输入进行的。以`ADD`操作为例，我们需要在调用`CNI`插件的时候，将操作的名称通过环境变量`CNI_COMMAND`设置，另外还需要设置`CNI_IFNAME`（网卡名称）、`CNI_NETNS`（Pod的网络命名空间路径）以及 `CNI_CONTAINERID`（容器ID）。

对于 `flannel-cni` 为例，它实现 `CNI` 的插件在 `/opt/cni/bin/flannel`，我们来看看它里面实现的[ADD](https://github.com/flannel-io/cni-plugin/blob/3716355d73841816c2049448c5ad0afe0e42e939/flannel_linux.go#L84)操作如下：

```go
func doCmdAdd(args *skel.CmdArgs, n *NetConf, fenv *subnetEnv) error {
	n.Delegate["name"] = n.Name

	if !hasKey(n.Delegate, "type") {
		n.Delegate["type"] = "bridge"
	}

	if !hasKey(n.Delegate, "ipMasq") {
		// if flannel is not doing ipmasq, we should
		ipmasq := !*fenv.ipmasq
		n.Delegate["ipMasq"] = ipmasq
	}

	if !hasKey(n.Delegate, "mtu") {
		mtu := fenv.mtu
		n.Delegate["mtu"] = mtu
	}

	if n.Delegate["type"].(string) == "bridge" {
		if !hasKey(n.Delegate, "isGateway") {
			n.Delegate["isGateway"] = true
		}
	}
	if n.CNIVersion != "" {
		n.Delegate["cniVersion"] = n.CNIVersion
	}

	ipam, err := getDelegateIPAM(n, fenv)
	if err != nil {
		return fmt.Errorf("failed to assemble Delegate IPAM: %w", err)
	}
	n.Delegate["ipam"] = ipam
	fmt.Fprintf(os.Stderr, "\n%#v\n", n.Delegate)

	return delegateAdd(args.ContainerID, n.DataDir, n.Delegate)
}

func delegateAdd(cid, dataDir string, netconf map[string]interface{}) error {
	netconfBytes, err := json.Marshal(netconf)
	fmt.Fprintf(os.Stderr, "delegateAdd: netconf sent to delegate plugin:\n")
	os.Stderr.Write(netconfBytes)
	if err != nil {
		return fmt.Errorf("error serializing delegate netconf: %v", err)
	}

	// save the rendered netconf for cmdDel
	if err = saveScratchNetConf(cid, dataDir, netconfBytes); err != nil {
		return err
	}

	result, err := invoke.DelegateAdd(context.TODO(), netconf["type"].(string), netconfBytes, nil)
	if err != nil {
		err = fmt.Errorf("failed to delegate add: %w", err)
		return err
	}
	return result.Print()
}
```

 `/opt/cni/bin/flannel`在每次被调用的时候会读取配置每个节点上的配置文件 `/run/flannel/subnet.env`，这部分代码实现请看[这里](https://github.com/flannel-io/cni-plugin/blob/3716355d73841816c2049448c5ad0afe0e42e939/flannel.go#L131C6-L131C26)。在`setupPodNetwork`中，沿着 `netPlugin.SetupSerially` 最终会到达[这里](https://github.com/containernetworking/cni/blob/66c292a7c5d69b6f285e6c519a472107b09a19ca/libcni/api.go#L482)，由它去调用`/opt/cni/bin/flannel`:

```go
func (c *CNIConfig) addNetwork(ctx context.Context, name, cniVersion string, net *NetworkConfig, prevResult types.Result, rt *RuntimeConf) (types.Result, error) {
	c.ensureExec()
	pluginPath, err := c.exec.FindInPath(net.Network.Type, c.Path)
	if err != nil {
		return nil, err
	}
	if err := utils.ValidateContainerID(rt.ContainerID); err != nil {
		return nil, err
	}
	if err := utils.ValidateNetworkName(name); err != nil {
		return nil, err
	}
	if err := utils.ValidateInterfaceName(rt.IfName); err != nil {
		return nil, err
	}

	newConf, err := buildOneConfig(name, cniVersion, net, prevResult, rt)
	if err != nil {
		return nil, err
	}

	return invoke.ExecPluginWithResult(ctx, pluginPath, newConf.Bytes, c.args("ADD", rt), c.exec)
}
```

打开`containerd`的`debug`日志之后，通过下面的命令可以查看在创建`Pod`的时候，通过标准输入提供给`/opt/cni/bin/flannel`的参数：

> `SYSTEMD_LESS="" journalctl  -eu containerd`

![](setup-pod-network-log.png)

{% note success 点击查看示例 %}
```json
{
  "cniVersion": "0.3.1",
  "hairpinMode": true,
  "ipMasq": false,
  "ipam": {
    "ranges": [
      [
        {
          "subnet": "10.244.1.0/24"
        }
      ]
    ],
    "routes": [
      {
        "dst": "10.244.0.0/16"
      }
    ],
    "type": "host-local"
  },
  "isDefaultGateway": true,
  "isGateway": true,
  "mtu": 1450,
  "name": "cbr0",
  "type": "bridge"
}
```
{% endnote %}

上面的参数还会保存在`/var/lib/cni/flannel/`路径下，按照`PodID`保存：

![](cni-plugin-params.png)

而且在`/var/lib/cni/networks/cbr0/`目录下还保存了已分配的`IP`和`Pod`的对应关系，`cbr0`指的是网络插件的名称，和 `/etc/cni/net.d/10-flannel.conflist` 里面的保持一致：

![](cni-assign-ip.png)

### 通用网络插件

当我们去看 `/opt/cni/bin/flannel` 的代码实现的时候，发现它并没有做什么创建网络的操作，它又调用了其他的插件：

```go
func delegateAdd(cid, dataDir string, netconf map[string]interface{}) error {
	netconfBytes, err := json.Marshal(netconf)
	fmt.Fprintf(os.Stderr, "delegateAdd: netconf sent to delegate plugin:\n")
	os.Stderr.Write(netconfBytes)
	...
    // 调用其他插件实现
	result, err := invoke.DelegateAdd(context.TODO(), netconf["type"].(string), netconfBytes, nil)
	if err != nil {
		err = fmt.Errorf("failed to delegate add: %w", err)
		return err
	}
	return result.Print()
}
```

从`CRI`传递给`flannel`的参数来看，实际调用的是`bridge`，所以说 `flannel` 这个网络插件实际上并没有做什么，他把具体的活又委托了出去。在`flannel-cni`插件的配置中有一个`delegate`字段，这个字段的意思表明了这个插件需要调用其他`CNI`的内置插件来完成，对于`flannel`来说，如果没有指定，就是 `bridge`，这些通用的[网络插件](https://www.cni.dev/plugins/current/) 由官方维护，它会被统一安装在 `/opt/cni/bin` 目录下：

![](general-net-plugin.png)

这些插件可以分为三类：

1. `Main`插件，它们是用来创建具体网络设备的二进制文件，比如：`bridge`、`ipvlan`、`loopback`、`tap`、`macvlan` 等；
2. `IPAM`插件，负责IP地址的分配，比如 `dhcp`，它会向`DHCP`服务器发起请求；`host-local` 会使用预先配置的地址段来进行分配，`flannel` 使用这种方式，它的本机上的分配的地址段放在了`/run/flannel/subnet.env`文件中，已分配的`IP`放在了 `/var/lib/cni/networks/cbr0/` 中；
3. `Meta`插件，例如通过`sysctl`调整网络设备参数的`tuning`，通过`iptables`配置端口映射的`portmap`，以及使用`TBF`来进行限流的`bandwidth`等，`flannel`也属于这一类，委托其他插件干活；

这些插件可以从[containernetworking/plugins](https://github.com/containernetworking/plugins/releases) 预编译的包中获取，解压到 `/opt/cni/bin` 目录下就可以了。

我们的`cni0`网桥就是在`bridge`中创建的，它在创建`Pod`网络的时候会检查`cni0`是否存在，不存在就创建，具体代码可以查看[这里](https://github.com/containernetworking/plugins/blob/b6a0e0bc96906f0d3bd6bfcaab0b5ae72292f46c/plugins/main/bridge/bridge.go#L336)。

通过一些简单的命令来演示下上述`bridge`创建网络的过程，首先 `bridge` 会检查宿主机上的 `cni0` 是否存在，没有的话就创建，相当于：

```shell
# 在宿主机上
$ ip link add cni0 type bridge
$ ip link set cni0 up
```

接下来就是进入到`pod`的网络空间内，创建一对 `veth` 设备，并且把其中一端移动到`Host`上：

```shell
# 在容器里

# 创建一对 veth 设备
$ ip link add eth0 type veth peer name vethb4963f3

# 启动eth0设备
$ ip link set eth0 up

# 将veth一端移动到host
$ ip link set vethb4963f3 netns $HOST_NS

# 启用vethb4963f3
$ ip netns exec $HOST_NS ip link set vethb4963f3 up
```

然后在宿主机上将 `vethb4963f3` 加入 `cni0` 网桥：

```shell
# 在宿主机上
$ ip link set vethb4963f3 master cni0
```

这部分请看[这里](https://github.com/containernetworking/plugins/blob/b6a0e0bc96906f0d3bd6bfcaab0b5ae72292f46c/plugins/main/bridge/bridge.go#L413)，如下所示：

```go
func setupVeth(netns ns.NetNS, br *netlink.Bridge, ifName string, mtu int, hairpinMode bool, vlanID int, vlans []int, preserveDefaultVlan bool, mac string) (*current.Interface, *current.Interface, error) {
	contIface := &current.Interface{}
	hostIface := &current.Interface{}

	err := netns.Do(func(hostNS ns.NetNS) error {
		// create the veth pair in the container and move host end into host netns
		hostVeth, containerVeth, err := ip.SetupVeth(ifName, mtu, mac, hostNS)
		if err != nil {
			return err
		}
		contIface.Name = containerVeth.Name
		contIface.Mac = containerVeth.HardwareAddr.String()
		contIface.Sandbox = netns.Path()
		hostIface.Name = hostVeth.Name
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	// need to lookup hostVeth again as its index has changed during ns move
	hostVeth, err := netlink.LinkByName(hostIface.Name)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to lookup %q: %v", hostIface.Name, err)
	}
	hostIface.Mac = hostVeth.Attrs().HardwareAddr.String()

	// connect host veth end to the bridge
	if err := netlink.LinkSetMaster(hostVeth, br); err != nil {
		return nil, nil, fmt.Errorf("failed to connect %q to bridge %v: %v", hostVeth.Attrs().Name, br.Attrs().Name, err)
	}

	// set hairpin mode
	if err = netlink.LinkSetHairpin(hostVeth, hairpinMode); err != nil {
		return nil, nil, fmt.Errorf("failed to setup hairpin mode for %v: %v", hostVeth.Attrs().Name, err)
	}

	...

	return hostIface, contIface, nil
}
```

这里有意思的是在将`veth`设备加入到网桥之后，还会将它设置为发夹模式（`HairPin Mode`），这是因为默认情况下，网桥设备不允许数据包从一个端口进来再从这个端口出去，但是设置为`HairPin Mode`就取消这个限制了。

这个特性，主要用在容器需要通过`NAT`（即：端口映射）的方式，自己访问自己的场景下。举个例子，比如我们执行`docker run -p 8080:80`，就是在宿主机上通过`iptables`设置了一条`DNAT`（目的地址转换）转发规则。这条规则的作用是，当宿主机上的进程访问`＜宿主机的IP地址＞:8080`时，`iptables`会把该请求直接转发到`＜容器的IP地址＞:80`上。也就是说，这个请求最终会经过`docker0`网桥进入容器里面。但如果是在容器里面访问宿主机的`8080`端口，那么这个容器里发出的`IP`包会经过`vethb4963f3`设备（端口）和`docker0`网桥，来到宿主机上。此时，根据上述`DNAT`规则，这个`IP`包又需要回到`docker0`网桥，并且还是通过`vethb4963f3`端口进入到容器里。所以，这种情况下，我们就需要开启`vethb4963f3`端口的`Hairpin Mode`了。

因此，`Flannel`插件要在`CNI`配置文件里声明`hairpinMode=true`。这样，将来这个集群里的`Pod`才可以通过它自己的`Service`访问到自己。
接下来，`bridge`插件会调用`CNI ipam`插件，从`ipam.subnet`字段规定的网段里为容器分配一个可用的`IP`地址。然后，`CNI bridge`插件就会把这个`IP`地址添加在容器的`eth0`网卡上，同时为容器设置默认路由。这相当于在容器里执行：

```shell
# 在容器里
$ ip addr add 10.244.1.9/24 dev eth0
$ ip route add default via 10.244.1.1 dev eth0
```

最后`bridge`会为`cni0`设置`IP`地址，相当于执行：

```shell
# 在主机上
$ ip addr add 10.244.0.1/24 dev cni0
```

上述这一系列昨晚之后，`CNI`插件会把结果一路返回到`containerd`中，这是我们从`containerd`的日志中获取到的结果信息：

```json
{
    "Interfaces":{
        "cni0":{
            "IPConfigs":null,
            "Mac":"5e:bb:f4:89:bb:2b",
            "Sandbox":""
        },
        "eth0":{
            "IPConfigs":[
                {
                    "IP":"10.244.1.9",
                    "Gateway":"10.244.1.1"
                }
            ],
            "Mac":"5e:0a:b7:ed:b0:24",
            "Sandbox":"/var/run/netns/cni-ff86766a-0712-7eab-d629-f315c74bb91b"
        },
        "lo":{
            "IPConfigs":[
                {
                    "IP":"127.0.0.1",
                    "Gateway":""
                },
                {
                    "IP":"::1",
                    "Gateway":""
                }
            ],
            "Mac":"00:00:00:00:00:00",
            "Sandbox":"/var/run/netns/cni-ff86766a-0712-7eab-d629-f315c74bb91b"
        },
        "veth8d17d860":{
            "IPConfigs":null,
            "Mac":"1e:a5:f7:be:fa:57",
            "Sandbox":""
        }
    },
    "DNS":[{},{}],
    "Routes":[
        {
            "dst":"10.244.0.0/16"
        },
        {
            "dst":"0.0.0.0/0",
            "gw":"10.244.1.1"
        }
    ]
}
```

![](pod-status.png)

### 多个网络插件

通常 `Pod` 内只有一个 `eth0` 网口，如果通过创建多个网络接口实现网络流量隔离，可以考虑使用[multus-cni](https://github.com/k8snetworkplumbingwg/multus-cni)。`Multus CNI` 是 `Kubernetes` 的一个容器网络接口 (`CNI`) 插件，可为 `Pod` 附加多个网络接口。下面是由 `Multus CNI` 提供的连接到 `pod` 的网络接口示意图。图中显示 `pod` 有三个接口：`eth0`、`net0` 和 `net1`。`eth0` 连接 `kubernetes` 集群网络，用于连接 `kubernetes` 服务器（如 `kubernetes api-server`、`kubelet` 等），属于集群默认网络。`net0` 和 `net1` 是附加网络接口，通过使用其他 `CNI` 插件（如 `vlan/vxlan/ptp`）连接其他网络。

![](https://github.com/k8snetworkplumbingwg/multus-cni/raw/master/docs/images/multus-pod-image.svg)

`Multus CNI` 有两种类型，`thick and thin`，其中 `thick` 由 `multus-daemon` 和 `multus-shim` 两个二进制文件组成 插件。`multus-daemon` 将作为本地代理部署到所有节点，相比 `thin` 具备额外功能（如度量），由于具有这些附加功能，要比 `thin` 消耗更多资源。`Multus CNI` 需要部署在已经安装默认 `CNI` 的集群中，并将其作为集群网络插件，可以参考它的 [quick-start](https://github.com/k8snetworkplumbingwg/multus-cni/blob/master/docs/quickstart.md) 进行安装，这里使用 `thick` 类型：

> `kubectl apply -f https://raw.githubusercontent.com/k8snetworkplumbingwg/multus-cni/master/deployments/multus-daemonset-thick.yml`

安装之后，可以看到类似的`Pod`正常运行即可：

```
$ kubectl get pods --all-namespaces | grep -i multus
kube-system         kube-multus-ds-m7gqc                      1/1     Running   0               158m
```

如果遇到启动失败，提示 `Error response from daemon: path /opt/cni/bin is mounted on / but it is not a shared mount` 这样的信息时，需要将`Host`的`/`目录标记为共享的，在`Host`上执行命令 `mount --make-rshared /`。如果默认的 `CNI` 插件使用 [cilium](https://docs.cilium.io/)，需要编辑它的`Agent`配置，设置 `cni-exclusive: "false"`（`kubectl edit cm -n kube-system cilium-config`）。

接下来创建附加网络的定义，这里的 `master` 指的的 `macvlan` 模式下的父接口，不同的插件配置有所不同：

```
kubectl create -n default -f - <<EOF
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: macvlan-conf
spec:
  config: '{
      "cniVersion": "0.3.1",
      "type": "macvlan",
      "master": "eth0",
      "mode": "bridge",
      "ipam": {
        "type": "host-local",
        "subnet": "172.28.240.0/20",
        "rangeStart": "172.28.252.2",
        "rangeEnd": "172.28.252.250",
        "routes": [
          { "dst": "0.0.0.0/0" }
        ],
        "gateway": "172.28.240.1"
      }
    }'
EOF
```

然后创建 `Pod` 进行测试：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: samplepod
  annotations:
    k8s.v1.cni.cncf.io/networks: macvlan-conf
spec:
  containers:
  - name: samplepod
    command: ["/bin/ash", "-c", "trap : TERM INT; sleep infinity & wait"]
    image: alpine
EOF
```

验证 `samplepod` 具有多个网口 `net1` 和 `eth0`：

```
$ kubectl exec -it samplepod -- ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: tunl0@NONE: <NOARP> mtu 1480 qdisc noop state DOWN qlen 1000
    link/ipip 0.0.0.0 brd 0.0.0.0
3: sit0@NONE: <NOARP> mtu 1480 qdisc noop state DOWN qlen 1000
    link/sit 0.0.0.0 brd 0.0.0.0
4: net1@tunl0: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
    link/ether e2:28:17:2f:d7:f3 brd ff:ff:ff:ff:ff:ff
    inet 172.28.244.2/20 brd 172.28.255.255 scope global net1
       valid_lft forever preferred_lft forever
315: eth0@if316: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP qlen 1000
    link/ether 4e:dd:fe:fa:67:28 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.213/32 scope global eth0
       valid_lft forever preferred_lft forever
```


### 参考链接

1. [CNI](https://www.cni.dev/plugins/current/ipam/host-local/)
2. [CNI with Multus](https://ubuntu.com/kubernetes/docs/cni-multus)
3. [Use Multus CNI in Kubernetes](https://devopstales.github.io/kubernetes/multus/)
4. [Kubernetes Network Model](https://www.zentao.pm/blog/kubernetes-network-model-1379.html)
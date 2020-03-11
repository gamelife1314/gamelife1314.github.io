---
title: Leetcode 刷题开始
mathjax: true
date: 2020-03-08 20:54:33
tags:
    - LeetCode
---

{% cq %}看到公司的各种考试，我有点怕，不好好刷题就会被淘汰，为了养家糊口，我要好好学习。{% endcq %}

{% asset_img cover.png cover %}

<!-- more -->


### 最长回文字符串

题目链接：[https://leetcode-cn.com/problems/longest-palindromic-substring/](https://leetcode-cn.com/problems/longest-palindromic-substring/)，求最长回文子串。

分析，对于一个字符串 “ababa” ，如果已经知道 “bab” 是回文，那么 “ababa” 一定是回文，因为它的左首字母和右尾字母是相同的。所以我们给出状态转移方程定义：

$$\begin{equation} \label{longestPalindrome}
dp(i,j)=\left\{
\begin{aligned}
true  &   & 如果 S_i ... S_j 是回文字符串 \\
false &   & 其他情况
\end{aligned}
\right.
\end{equation}$$


所以，就有

$$\begin{equation}
dp(i,j) = (dp(i + 1, j - 1) \ \  and \ \   S_i == S_j)
\end{equation}$$

这样，我们就从一个字母的回文开始找，一直找到最长的回文字符串。我们分析下复杂度：

- 时间复杂度：$\mathcal{O}(n^2)$
- 空间复杂度：$\mathcal{O}(n^2)$，需要一个二维数组来存储

我们用 `dp[i][j]` 表示 $S_i...S_j$ 是否是回文子串，我们再分析状态转移方程，就能得出：

- `i <= j`，因此只需要二维数组的上班部分
- 因为存在 `dp[i+1][j-1]`，我们就要考虑边界

边界条件是：表达式 `[i + 1, j - 1]` 不构成区间，即长度严格小于 `2`，即 `j - 1 - (i + 1) + 1 < 2` ，整理得 `j - i < 3`。

这个结论很显然：当子串 `s[i, j]` 的长度等于 `2` 或者等于 `3` 的时候，我其实只需要判断一下头尾两个字符是否相等就可以直接下结论了。

如果子串 `s[i + 1, j - 1]` 只有 `1` 个字符，即去掉两头，剩下中间部分只有 `1` 个字符，当然是回文；
如果子串 `s[i + 1, j - 1]` 为空串，那么子串 `s[i, j]` 一定是回文子串。
因此，在 `s[i] == s[j]` 成立和 `j - i < 3` 的前提下，直接可以下结论，`dp[i][j] = true`，否则才执行状态转移。


```go
package main

import "fmt"

func longestPalindrome(s string) string {
	if len(s) < 2 {
		return s
	}
	strLen := len(s)
	var dp  = make([][]bool, strLen)
	for i := 0; i < strLen; i ++ {
		dp[i] = make([]bool, strLen)
		dp[i][i] = true
	}
	start := 0
	maxLen := 1
	for j := 1; j < strLen; j ++ {
		for i :=0;i < strLen; i ++ {
			if s[i] == s[j] {
				if j - i < 3 {
					dp[i][j] = true
				} else {
					dp[i][j] = dp[i+1][j-1]
				}
			} else {
				dp[i][j] = false
			}
			if dp[i][j] {
				curMaxLen := j - i + 1
				if curMaxLen > maxLen {
					maxLen = curMaxLen
					start = i
				}
			}
		}
	}
	return s[start:start+maxLen]
}

func main() {
	fmt.Println(longestPalindrome("cbbd"))
}

```


### 正则匹配

题目链接：[https://leetcode-cn.com/problems/regular-expression-matching/](https://leetcode-cn.com/problems/regular-expression-matching/)

#### 递归

基于题解 [https://leetcode-cn.com/problems/regular-expression-matching/solution/ji-yu-guan-fang-ti-jie-gen-xiang-xi-de-jiang-jie-b/](https://leetcode-cn.com/problems/regular-expression-matching/solution/ji-yu-guan-fang-ti-jie-gen-xiang-xi-de-jiang-jie-b/) 说两句自己的看法，详情请看原处。

源串我们假设为：`str`，正则为：`pattern`。

难点在于如何处理 `*` 匹配 `0` 次和多次，`*` 的含义是匹配前面的字符 `0` 次或者多次，那么其实也就是在遇到 `*`时：

- `str` 不动，向后移动 `pattern`，没匹配上；

- 或者 `pattern` 不动，`str` 向后移动，前提是 `str` 第一个字符和 `pattern` 匹配上了；

再就是 `.`，表示任意一个字符，那么 `pattern` 中的某个字符要么是 `.`，要么是 `str` 中将要被匹配的字符，就表示匹配上了。


```go
package main

import "fmt"

func isMatch(s string, p string) bool {
	if len(p) == 0 {
		return len(s) == 0
	}
	firstMatch := false
	if len(s) > 0 {
		if p[0] == '.' || p[0] == s[0] {
			firstMatch = true
		}
	}
	if len(p) >= 2 && p[1] == '*' {
		return isMatch(s, p[2:]) || (firstMatch && isMatch(s[1:], p))
	}
	return firstMatch && isMatch(s[1:], p[1:])
}

func main() {
	fmt.Println(isMatch("aba", "ab*"))
	fmt.Println(isMatch("aba", "aba"))
	fmt.Println(isMatch("aba", ".*"))
}

```

### 最长有效括号

题目链接：https://leetcode-cn.com/problems/longest-valid-parentheses/

参考题解：https://leetcode-cn.com/problems/longest-valid-parentheses/solution/zui-chang-you-xiao-gua-hao-by-leetcode/

良好的解题思路是成功的一般，我们用一个长度和字符串长度相同的 dp 数组记录到第 i 个字符最长有效括号长度。另外有效括号字符串肯定是以 ) 结尾的，假如第 i 个字符是 )，那么：

- 如果第 `i-1` 个字符是 `(`， 这种形式： `...()`, `dp[i] = dp[i-2] + 2`

- 如果第 `i-1` 个字符是 `)`，那么就是这种形式： `...))`，`dp[i] = dp[i-1] + 2 + dp[i-dp[i-1]-2]`

```go
func longestValidParentheses(s string) int {
    if len(s) == 0 {
        return 0
    }
    var dp = make([]int, len(s))
    var maxLen = 0
    for i := 1; i < len(s); i++ {
        if s[i] == '(' {
            continue
        }
        if s[i-1] == '(' {
            if i >= 2 {
                dp[i] = dp[i-2] + 2
            } else {
                dp[i] = 2
            }
        } else if i-dp[i-1]-1 >= 0 && s[i-dp[i-1]-1] == '(' {
            if i-dp[i-1] >= 2 {
                dp[i] = dp[i-1] + dp[i-dp[i-1]-2] + 2
            } else {
                dp[i] = dp[i-1] + 2
            }
        }
        if dp[i] > maxLen {
            maxLen = dp[i]
        }
    }
    return maxLen
}
```